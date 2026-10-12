<#
.SYNOPSIS
  Démo D — préparation, une fois (J-1) : l'équipe IA publie les outils d'entreprise
  pour les agents, et l'application GitHub des tickets.

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
    4. Application GitHub des tickets (-GitHubAppId, -GitHubAppKeyPath) : secrets de
       l'environnement « ai-team », lus par Agent Ready (TF_VAR_github_app_*).

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
  [string[]]$EquipesAzure = @("equipe-ops"),
  [string]$GitHubAppId,
  [string]$GitHubAppKeyPath
)

. (Join-Path $PSScriptRoot "..\lib.ps1")
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
try {
  Invoke-Native { kubectl apply -k $work } "kubectl apply -k plateforme"
} finally { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }
Invoke-Native { kubectl -n $ns rollout status deploy/azure-mcp --timeout=240s } "Azure MCP Server prêt"
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
Step "4 · Application GitHub des tickets → environnement « ai-team »"
Push-Location $script:RepoRoot
try {
  $repo = (gh repo view --json nameWithOwner --jq .nameWithOwner)
  if ($GitHubAppId -and $GitHubAppKeyPath) {
    if (-not (Test-Path $GitHubAppKeyPath)) { throw "clé introuvable : $GitHubAppKeyPath" }
    Invoke-Native { gh variable set TICKETS_GITHUB_APP_ID --env ai-team --body $GitHubAppId --repo $repo } "variable TICKETS_GITHUB_APP_ID"
    Get-Content $GitHubAppKeyPath -Raw | gh secret set TICKETS_GITHUB_APP_PRIVATE_KEY --env ai-team --repo $repo
    if ($LASTEXITCODE -ne 0) { throw "gh secret set" }
    Ok "TICKETS_GITHUB_APP_ID, TICKETS_GITHUB_APP_PRIVATE_KEY (entrée standard de gh, rien sur disque)"
  } else {
    Info "-GitHubAppId / -GitHubAppKeyPath absents : étape sautée (run.ps1 peut poser le Secret lui-même)."
  }
  $wf = Join-Path $script:RepoRoot ".github\workflows\agent-ready.yml"
  if ((Test-Path $wf) -and (Select-String -Path $wf -Pattern "TF_VAR_github_app_id" -Quiet)) {
    Ok "agent-ready.yml transmet l'application GitHub à Terraform"
  } else {
    Ko "agent-ready.yml ne transmet pas encore l'application GitHub — ajouter à l'étape terraform :"
    Show-Code @'
        env:
          TF_VAR_github_app_id: ${{ vars.TICKETS_GITHUB_APP_ID }}
          TF_VAR_github_app_private_key: ${{ secrets.TICKETS_GITHUB_APP_PRIVATE_KEY }}
'@
  }
} finally { Pop-Location }
Info "Démo : ./demos/D-agent-ops/run.ps1"
