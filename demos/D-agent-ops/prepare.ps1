<#
.SYNOPSIS
  Démo D — préparation, une fois (J-1) : l'équipe IA publie les outils d'entreprise
  pour les agents, et l'émetteur de jetons GitHub des tickets.

.DESCRIPTION
  Prérequis : ./scripts/deploy.ps1, puis ./demos/B-agent-equipe/prepare.ps1 (démo D
  réutilise le pipeline « Agent Ready »). az, kubectl (contexte admin), gh connectés.

    1. Identité managée id-<base>-azure-mcp, fédérée avec le ServiceAccount
       outils-entreprise/azure-mcp (Workload Identity) ; rôle Reader sur le groupe
       de ressources de la plateforme et sur celui des équipes. Rien d'autre.
    2. Azure MCP Server (lecture seule) dans outils-entreprise, et la route agents
       /agents/mcp-entreprise : Azure + Microsoft Learn derrière la passerelle, clé
       d'équipe obligatoire, Azure réservé aux équipes de -EquipesAzure.
    3. Vérification : sans clé 401 ; clé « platform » → Learn seulement.
    4. Émetteur de jetons GitHub (tools/github-token-issuer) : image construite dans le
       registre de la plateforme (az acr build), CronJob dans le namespace jetons-github,
       seul endroit où vit la clé privée de l'application GitHub (-GitHubAppId,
       -GitHubAppKeyPath). Toutes les 30 min, chaque équipe reçoit dans son Secret
       github-token un jeton d'une heure limité à agent-<équipe> et issues:write.

  Application GitHub (une fois, à la main) : Settings → Developer settings → GitHub
  Apps → New. Webhook désactivé ; permissions de dépôt Issues : Read and write,
  Metadata : Read-only ; installée sur le propriétaire des dépôts d'équipes, « All
  repositories » (les dépôts agent-<équipe> sont créés après). Générer une clé privée.

.EXAMPLE
  ./demos/D-agent-ops/prepare.ps1 -GitHubAppId 1234567 -GitHubAppKeyPath $HOME\Downloads\agent-tickets.pem
  ./demos/D-agent-ops/prepare.ps1 -EquipesAzure equipe-ops, equipe-sre
#>
[CmdletBinding()]
param(
  # Validés : ces noms sont insérés dans une règle CEL de la passerelle.
  # -cmatch et \A…\z (chaque élément) : ni majuscules, ni retour à la ligne final.
  [ValidateScript({ $_ -cmatch '\A[a-z][a-z0-9-]{1,18}[a-z0-9]\z' })]
  [string[]]$EquipesAzure = @("equipe-ops"),
  [ValidateScript({ $_ -cmatch '\A[0-9]{1,12}\z' })]
  [string]$GitHubAppId,
  [string]$GitHubAppKeyPath
)

. (Join-Path $PSScriptRoot "..\lib.ps1")

# Une seule politique d'autorisation MCP par backend. Plusieurs politiques Allow
# sur le même backend s'additionnent (OU) : une ancienne politique oubliée
# (kubectl apply -k n'élague rien) rouvre ce que la liste blanche ferme.
function Assert-OneMcpAuthorization {
  # lib.ps1 active StrictMode 2.0 : un backend sans spec.mcp ou une politique sans
  # spec.backend lèverait une erreur à l'accès. Désactivé dans cette fonction seulement.
  Set-StrictMode -Off
  $backends = @((Get-KubeJson @("get", "agentgatewaybackends", "-A")).items | Where-Object { $_.spec.mcp })
  $policies = @((Get-KubeJson @("get", "agentgatewaypolicies", "-A")).items | Where-Object { $_.spec.backend.mcp.authorization })
  $doublons = @()
  foreach ($b in $backends) {
    $ns = $b.metadata.namespace; $name = $b.metadata.name
    $matching = @($policies | Where-Object {
        $p = $_
        $p.metadata.namespace -eq $ns -and @($p.spec.targetRefs | Where-Object { $_.kind -eq "AgentgatewayBackend" -and $_.name -eq $name }).Count -gt 0
      } | ForEach-Object { $_.metadata.name })
    if ($matching.Count -gt 1) { $doublons += "$ns/$name : $($matching -join ', ')" }
    elseif ($matching.Count -eq 0) { Info "backend MCP $ns/$name : aucune liste blanche d'outils" }
  }
  if ($doublons.Count -gt 0) {
    $doublons | ForEach-Object { Ko "plusieurs politiques d'autorisation MCP — $_" }
    throw "plusieurs AgentgatewayPolicy d'autorisation MCP sur un même backend : supprimer les anciennes (kubectl -n <ns> delete agentgatewaypolicy <nom>)"
  }
  Ok "une seule liste blanche d'outils par backend MCP ($($backends.Count) backend(s))"
}

Assert-Tools @("az", "kubectl", "terraform", "gh")
$ns = "outils-entreprise"
$sa = "azure-mcp"

Step "0 · Sorties Terraform de la plateforme"
$rg = Get-TfOutput "resource_group_name"
$teamsRg = Get-TfOutput "teams_resource_group_name"
$issuer = Get-TfOutput "aks_oidc_issuer_url"
$location = Get-TfOutput "location"
$tenant = Get-TfOutput "tenant_id"
$subscription = Get-TfOutput "subscription_id"
$identity = "id-$($rg -replace '^rg-', '')-azure-mcp"
Ok "groupe $rg · équipes $teamsRg · identité $identity"

# -----------------------------------------------------------------------------
Step "1 · Identité de l'Azure MCP Server : fédérée, Reader, sans secret"
if (-not (Test-Native { az identity show -g $rg -n $identity -o none })) {
  Invoke-Native { az identity create -g $rg -n $identity -l $location --tags "cree-par=demo-d" -o none } "az identity create"
}
$clientId = az identity show -g $rg -n $identity --query clientId -o tsv
$principalId = az identity show -g $rg -n $identity --query principalId -o tsv
$fic = Get-NativeOutput { az identity federated-credential list -g $rg --identity-name $identity --query "[?name=='aks-azure-mcp'].name" -o tsv }
if (-not $fic) {
  Invoke-Native { az identity federated-credential create -g $rg --identity-name $identity --name aks-azure-mcp `
      --issuer $issuer --subject "system:serviceaccount:$($ns):$sa" --audiences "api://AzureADTokenExchange" -o none } "fédération"
}
Ok "fédérée avec system:serviceaccount:$($ns):$sa"
foreach ($scopeRg in @($rg, $teamsRg)) {
  $scope = az group show -n $scopeRg --query id -o tsv
  $has = Get-NativeOutput { az role assignment list --assignee $principalId --scope $scope --role Reader --query "[].id" -o tsv }
  if (-not $has) {
    # Une identité toute neuve peut mettre quelques secondes à être visible d'ARM.
    for ($i = 1; $i -le 6; $i++) {
      if (Test-Native { az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role Reader --scope $scope -o none }) { break }
      if ($i -eq 6) { throw "rôle Reader sur $scopeRg refusé" }
      Start-Sleep -Seconds 10
    }
  }
  Ok "Reader sur $scopeRg"
}

# -----------------------------------------------------------------------------
Step "2 · Azure MCP Server et route /agents/mcp-entreprise (copie rendue, rien dans le dépôt)"
$work = Join-Path ([IO.Path]::GetTempPath()) ("demo-d-plateforme-" + (Get-Date -Format "HHmmss"))
Copy-Item (Join-Path $PSScriptRoot "plateforme") $work -Recurse
$celEquipes = "[" + (($EquipesAzure | ForEach-Object { '"' + $_ + '"' }) -join ", ") + "]"
$markers = @{ "__AZURE_MCP_CLIENT_ID__" = $clientId; "__TENANT_ID__" = $tenant; "__SUBSCRIPTION_ID__" = $subscription; "__EQUIPES_AZURE__" = $celEquipes }
foreach ($f in Get-ChildItem $work -Filter *.yaml) {
  $text = [IO.File]::ReadAllText($f.FullName)
  foreach ($k in $markers.Keys) { $text = $text.Replace($k, $markers[$k]) }
  [IO.File]::WriteAllText($f.FullName, $text, [Text.UTF8Encoding]::new($false))
}
# Ancienne liste NOIRE sur mcp-equipes (avant l'audit d'octobre 2026) : apply -k
# ne la supprime pas, et avec outils-equipes-autorises elle ouvrirait tout (OU).
Invoke-Native { kubectl -n agentgateway-system delete agentgatewaypolicy outils-equipes-lecture --ignore-not-found } "suppression de outils-equipes-lecture"
try {
  Invoke-Native { kubectl apply -k $work } "kubectl apply -k plateforme"
} finally { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
Invoke-Native { kubectl -n $ns rollout status deploy/azure-mcp --timeout=240s } "Azure MCP Server prêt"
Assert-OneMcpAuthorization
Ok "Azure : équipes $($EquipesAzure -join ', ') · Learn : toutes les équipes"

# -----------------------------------------------------------------------------
Step "3 · Vérification par la passerelle"
Start-Gateway
$anon = Invoke-Http -Method POST -Url "$($script:Gw)/agents/mcp-entreprise" -Body @{ jsonrpc = "2.0"; id = 1; method = "tools/list" }
if ($anon.Code -eq 401) { Ok "sans clé : 401" } else { Ko "sans clé : attendu 401, reçu $($anon.Code)" }
$raw = kubectl -n kagent get secret gateway-key -o jsonpath="{.data.key}"
$platformKey = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($raw))
$list = Invoke-Mcp -Path "/agents/mcp-entreprise" -Token $platformKey -Method "tools/list"
if ($list.Code -eq 200 -and $list.Result -and ($list.Result.PSObject.Properties.Name -contains "result")) {
  $names = @($list.Result.result.tools | ForEach-Object { $_.name })
  Info ("clé « platform » : " + ($names -join ", "))
  if (@($names | Where-Object { $_ -like "azure_*" }).Count -eq 0) { Ok "Azure masqué hors liste d'équipes" } else { Ko "Azure visible pour « platform » : règle apiKey.team à vérifier" }
} else { Ko "tools/list : HTTP $($list.Code) — Learn joignable depuis le cluster ?" }
$platformKey = $null
Info "Azure lui-même se vérifie avec la clé de l'équipe, dans run.ps1 (étape 3)."

# -----------------------------------------------------------------------------
Step "4 · Émetteur de jetons GitHub : la clé reste dans jetons-github"
Push-Location $script:RepoRoot
try {
  $repo = (gh repo view --json nameWithOwner --jq .nameWithOwner)
} finally { Pop-Location }
$owner = $repo.Split("/")[0]
$acr = Get-TfOutput "acr_name"
$loginServer = Get-TfOutput "acr_login_server"
$tag = Get-Date -Format "yyyyMMddHHmmss"
$image = "$loginServer/plateforme/github-token-issuer:$tag"
Invoke-Native { az acr build -r $acr -t "plateforme/github-token-issuer:$tag" (Join-Path $script:RepoRoot "tools\github-token-issuer") -o none } "az acr build (émetteur)"
Ok "image $image"

$text = [IO.File]::ReadAllText((Join-Path $script:RepoRoot "tools\github-token-issuer\deploy\emetteur.yaml"))
$text = $text.Replace("__IMAGE__", $image).Replace("__GITHUB_OWNER__", $owner)
Invoke-KubectlApply $text "émetteur de jetons GitHub"

if ($GitHubAppId -and $GitHubAppKeyPath) {
  if (-not (Test-Path $GitHubAppKeyPath)) { throw "clé introuvable : $GitHubAppKeyPath" }
  # Clé lue depuis le fichier par kubectl (jamais dans la ligne de commande), manifeste
  # transmis par l'entrée standard, rien d'écrit sur disque.
  $secret = kubectl -n jetons-github create secret generic github-app "--from-literal=app-id=$GitHubAppId" "--from-file=private-key=$GitHubAppKeyPath" --dry-run=client -o yaml
  if ($LASTEXITCODE -ne 0) { throw "kubectl create secret (dry-run)" }
  Invoke-KubectlApply ($secret -join "`n") "Secret github-app"
  $secret = $null
  Ok "clé de l'application dans jetons-github/github-app — supprimez maintenant le fichier .pem de ce poste"
} elseif (-not (Test-Native { kubectl -n jetons-github get secret github-app })) {
  Ko "Secret jetons-github/github-app absent : relancer avec -GitHubAppId <id> -GitHubAppKeyPath <clé.pem>"
}

# Un premier passage tout de suite, sans attendre la demi-heure.
$job = "emetteur-manuel-$tag"
Invoke-Native { kubectl -n jetons-github create job --from=cronjob/emetteur-jetons-github $job | Out-Null } "premier passage de l'émetteur"
if (Test-Native { kubectl -n jetons-github wait --for=condition=complete "job/$job" --timeout=120s }) {
  Ok "premier passage terminé (équipes sans Secret github-token : ignorées jusqu'à leur Agent Ready)"
} else { Ko "premier passage en échec : kubectl -n jetons-github logs job/$job" }
Info "Démo : ./demos/D-agent-ops/run.ps1"
