<#
.SYNOPSIS
  Démo D — Une équipe construit son agent d'exploitation autour des MCP d'entreprise :
  Azure MCP Server + Microsoft Learn (publiés par la plateforme) + ses tickets GitHub. En direct.

.DESCRIPTION
  Même processus que la démo B, avec une équipe d'exploitation :
  1. Équipe IA : « Agent Ready » pour l'équipe (identités, namespace, clé virtuelle,
     dépôt) ; l'émetteur de la plateforme dépose dans son namespace un jeton GitHub
     d'une heure, limité à son dépôt — jamais la clé de l'application.
  2. Passerelle : /agents/mcp-entreprise — 401 sans clé ; la clé de l'équipe voit
     azure_* et learn_* ; la clé d'une autre équipe ne voit que Learn.
  3. Équipe de dev : un commit — trois outils « tickets » dans SON serveur MCP,
     un agent, son runbook — « 1 · Image » puis « 2 · Déploiement ».
  4. L'agent diagnostique le cluster AKS (Azure, lecture seule), cite Microsoft Learn,
     applique le runbook et propose un ticket.
  5. Un humain approuve dans kagent : l'issue apparaît dans le dépôt de l'équipe.
  6. Même demande rejouée : pas de doublon. Tout est compté par équipe dans Grafana.

  Prérequis : prepare.ps1 (une fois), et ceux de la démo B. Port-forward de l'UI
  kagent (8081) ouvert : l'agent est interrogé (étape 4) et approuvé (étape 5) dans
  l'UI — il n'est pas publié aux personnes sur /mcp.

.EXAMPLE
  ./demos/D-agent-ops/run.ps1
  ./demos/D-agent-ops/run.ps1 -SansAgentReady            # équipe déjà prête (répétition)
#>
[CmdletBinding()]
param(
  # Inséré dans du YAML et du code poussés au dépôt. -cmatch et \A…\z : ni
  # majuscules, ni retour à la ligne final (« $ » de ValidatePattern l'accepte).
  [ValidateScript({ $_ -cmatch '\A[a-z][a-z0-9-]{1,18}[a-z0-9]\z' })]
  [string]$Equipe = "equipe-ops",
  [string]$Description = "Agent d'exploitation : diagnostic Azure, documentation Microsoft, tickets GitHub",
  [switch]$SansAgentReady
)

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("az", "kubectl", "terraform", "gh", "git")
Push-Location $script:RepoRoot
$platformRepo = (gh repo view --json nameWithOwner --jq .nameWithOwner)
Pop-Location
$owner = $platformRepo.Split("/")[0]
$teamRepo = "$owner/agent-$Equipe"
$aks = Get-TfOutput "aks_cluster_name"
$aksRg = Get-TfOutput "resource_group_name"
$kit = Join-Path $PSScriptRoot "kit-equipe"

function Get-SecretValue([string]$Namespace, [string]$Name, [string]$Key) {
  $raw = Get-NativeOutput { kubectl -n $Namespace get secret $Name -o "jsonpath={.data.$Key}" }
  if (-not $raw) { return $null }
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("$raw"))
}

function Show-Tools([string]$Label, [string]$Key) {
  $r = Invoke-Mcp -Path "/agents/mcp-entreprise" -Token $Key -Method "tools/list"
  if ($r.Code -ne 200 -or -not $r.Result -or -not ($r.Result.PSObject.Properties.Name -contains "result")) {
    Ko "$Label : HTTP $($r.Code)"; return @()
  }
  $names = @($r.Result.result.tools | ForEach-Object { $_.name })
  Info ("{0,-22} {1}" -f $Label, ($names -join "  "))
  return $names
}

function Get-AgentIssues {
  $raw = Get-NativeOutput { gh issue list --repo $teamRepo --label agent --state open --json "number,title,url" }
  if (-not $raw) { return @() }
  return @($raw | Out-String | ConvertFrom-Json)
}

# -----------------------------------------------------------------------------
Step "0 · Une équipe d'exploitation veut un agent qui lit Azure, cite Microsoft et ouvre des tickets"
Info "Trois MCP : deux publiés par la plateforme (Azure, Learn), un construit par l'équipe (tickets GitHub)."
Info "Aucun n'est branché en direct : la passerelle authentifie, filtre par équipe et compte."
Wait-Demo

# -----------------------------------------------------------------------------
Step "1 · Équipe IA : « Agent Ready » pour $Equipe"
if ($SansAgentReady) {
  Info "sauté (-SansAgentReady) : l'équipe existe déjà"
} else {
  $since = Get-Date
  Invoke-Native { gh workflow run agent-ready.yml --repo $platformRepo -f "equipe=$Equipe" -f "description=$Description" -f "action=apply" } "gh workflow run agent-ready"
  Info "GitHub → Actions → « Agent Ready » → Review deployments → ai-team → Approve"
  if (Wait-Run $platformRepo "agent-ready.yml" $since 900) { Ok "équipe $Equipe : Agent Ready" } else { throw "Agent Ready en échec : voir le run" }
}
if (-not (Get-SecretValue $Equipe "gateway-key" "authorization")) {
  throw "gateway-key sans clé « authorization » : terraform/teams/main.tf de la démo D appliqué ?"
}
# Le jeton GitHub de l'équipe : l'émetteur de la plateforme passe toutes les 30 min ;
# pour la démo, un passage tout de suite.
$job = "emetteur-$Equipe-" + (Get-Date -Format "HHmmss")
Invoke-Native { kubectl -n jetons-github create job --from=cronjob/emetteur-jetons-github $job | Out-Null } "passage de l'émetteur (prepare.ps1 fait ?)"
[void](Test-Native { kubectl -n jetons-github wait --for=condition=complete "job/$job" --timeout=120s })
if (Get-SecretValue $Equipe "github-token" "token") {
  Ok "jeton GitHub dans $Equipe/github-token : 1 h, $teamRepo seul, issues:write — la clé de l'application reste dans jetons-github"
} else {
  throw "jeton GitHub absent dans $Equipe/github-token : kubectl -n jetons-github logs job/$job (application installée sur $teamRepo ?)"
}
Wait-Demo

# -----------------------------------------------------------------------------
Step "2 · La passerelle : un point d'entrée, des outils par équipe"
# Cluster préparé avant l'audit d'octobre 2026 : l'ancienne politique (liste noire)
# s'additionnerait à la liste blanche de /mcp-equipes. prepare.ps1 la supprime.
if (Test-Native { kubectl -n agentgateway-system get agentgatewaypolicy outils-equipes-lecture }) {
  throw "agentgatewaypolicy outils-equipes-lecture encore présente : relancer ./demos/D-agent-ops/prepare.ps1 (ou reset.ps1 -Plateforme)"
}
Start-Gateway
$anon = Invoke-Http -Method POST -Url "$($script:Gw)/agents/mcp-entreprise" -Body @{ jsonrpc = "2.0"; id = 1; method = "tools/list" }
if ($anon.Code -eq 401) { Ok "sans clé : 401" } else { Ko "sans clé : attendu 401, reçu $($anon.Code)" }
$teamKey = Get-SecretValue $Equipe "gateway-key" "key"
$otherKey = Get-SecretValue "kagent" "gateway-key" "key"
$mine = Show-Tools "clé $Equipe :" $teamKey
[void](Show-Tools "clé platform :" $otherKey)
$teamKey = $null; $otherKey = $null
if (@($mine | Where-Object { $_ -like "azure_*" }).Count -gt 0) { Ok "Azure (lecture seule) pour $Equipe ; Learn pour toutes les équipes ; code samples fermés" }
else { Ko "aucun outil azure_* pour $Equipe : -EquipesAzure de prepare.ps1 ?" }
Wait-Demo

# -----------------------------------------------------------------------------
Step "3 · Équipe de dev : un commit — trois outils tickets, un agent, un runbook"
$work = Join-Path ([IO.Path]::GetTempPath()) ("agent-$Equipe-" + (Get-Date -Format "HHmmss"))
Invoke-Native { gh repo clone $teamRepo $work -- --quiet } "gh repo clone"
$files = @("mcp\server.py", "mcp\tickets.py", "mcp\requirements.txt", "mcp\Dockerfile",
  "deploy\tickets-patch.yaml", "deploy\outils-entreprise.yaml", "deploy\assistant-ops.yaml", "docs\runbook-incidents.md")
foreach ($f in $files) {
  $text = [IO.File]::ReadAllText((Join-Path $kit $f))
  $text = $text.Replace("__EQUIPE__", $Equipe).Replace("__GITHUB_REPO__", $teamRepo)
  $dest = Join-Path $work $f
  New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
  [IO.File]::WriteAllText($dest, $text, [Text.UTF8Encoding]::new($false))
}
# Le kustomization de l'équipe : deux ressources et un patch de plus.
$kz = Join-Path $work "deploy\kustomization.yaml"
$k = [IO.File]::ReadAllText($kz)
if ($k -notmatch "assistant-ops.yaml") {
  $k = $k -replace "(?m)^resources:\s*$", "resources:`n  - outils-entreprise.yaml`n  - assistant-ops.yaml"
  $k = $k.TrimEnd() + "`npatches:`n  - path: tickets-patch.yaml`n"
  [IO.File]::WriteAllText($kz, $k, [Text.UTF8Encoding]::new($false))
}
Push-Location $work
try {
  Invoke-Native { git add -A } "git add"
  Invoke-Native { git --no-pager diff --cached --stat } "git diff"
  Invoke-Native { git -c user.name="Équipe $Equipe" -c user.email="dev@$Equipe.invalid" commit -q -m "Agent d'exploitation : tickets GitHub, outils d'entreprise, runbook" } "git commit"
  $since = Get-Date
  Invoke-Native { git push -q } "git push"
} finally { Pop-Location }
if (Wait-Run $teamRepo "1-image.yml" $since) { Ok "image reconstruite (tickets.py)" } else { Ko "1 · Image en échec" }
if (Wait-Run $teamRepo "2-deploiement.yml" $since) { Ok "déployé dans $Equipe" } else { Ko "2 · Déploiement en échec" }
Invoke-Native { kubectl -n $Equipe rollout status deploy/docs-mcp --timeout=180s } "serveur MCP de l'équipe"
Invoke-Native { kubectl -n $Equipe get agent,remotemcpserver } "objets kagent"
Wait-Demo

# -----------------------------------------------------------------------------
Step "4 · L'agent diagnostique : Azure (lu), Microsoft Learn (cité), runbook (appliqué)"
$diag = "Diagnostique le cluster AKS $aks (groupe de ressources $aksRg) : version de Kubernetes, état des pools de nœuds, " +
  "santé de la ressource. Compare la version au calendrier de support AKS sur Microsoft Learn, applique notre runbook " +
  "et propose un ticket (titre, sévérité, ressource, sources). Ne crée pas le ticket."
# Par l'UI kagent, comme l'étape 5 : assistant-ops (Reader Azure, tickets) n'est
# PAS publié aux personnes — invoke_agent sur /mcp le refuse
# (gateway/deploy/autorisations-mcp.yaml, liste des agents publiés).
Info "UI kagent → http://localhost:8081 → $Equipe/assistant-ops →"
Show-Code "  $diag"
[void](Read-Host "  (Entrée une fois la réponse affichée)")
Info "attendu : constat lu dans Azure (Reader), sources Learn, sévérité du runbook — coût attribué à $Equipe"
Wait-Demo

# -----------------------------------------------------------------------------
Step "5 · Le ticket : l'agent propose, un humain approuve"
$create = "Diagnostique le cluster AKS $aks (groupe $aksRg) comme le prévoit notre runbook, puis crée le ticket correspondant " +
  "avec l'identifiant complet de la ressource et les URL Microsoft Learn de la remédiation."
$before = @(Get-AgentIssues).Count
# Toujours par l'UI : creer_ticket et commenter_ticket attendent une approbation
# humaine (requireApproval) — il n'existe volontairement pas de mode sans.
Info "UI kagent → http://localhost:8081 → $Equipe/assistant-ops →"
Show-Code "  $create"
Info "L'agent s'arrête sur creer_ticket : relire les arguments, puis Approve."
[void](Read-Host "  (Entrée une fois approuvé)")
$issues = @(Get-AgentIssues)
for ($i = 0; $i -lt 20 -and $issues.Count -le $before; $i++) { Start-Sleep -Seconds 3; $issues = @(Get-AgentIssues) }
if ($issues.Count -gt $before) {
  $issues | ForEach-Object { Info ("#{0}  {1}  {2}" -f $_.number, $_.title, $_.url) }
  Ok "issue dans $teamRepo — jeton GitHub d'une heure, ce dépôt seul, issues:write"
} else { Ko "aucune nouvelle issue étiquetée « agent » dans $teamRepo" }
Wait-Demo

# -----------------------------------------------------------------------------
Step "6 · Les règles de l'équipe tiennent : même demande, pas de doublon"
Info "Rejouer la même demande dans l'UI kagent (l'agent liste d'abord les tickets ouverts)."
[void](Read-Host "  (Entrée pour compter les tickets)")
$after = @(Get-AgentIssues).Count
if ($after -eq $issues.Count) { Ok "toujours $after ticket(s) ouvert(s) : l'existant est renvoyé ou commenté" } else { Ko "$after tickets ouverts (attendu $($issues.Count))" }
Info "Depuis LibreChat (/mcp-equipes), creer_ticket et commenter_ticket n'existent pas : écrire reste un geste approuvé de l'agent."
Info "Et sur /mcp, invoke_agent refuse $Equipe/assistant-ops : seuls les agents publiés par la plateforme répondent aux personnes."
Info "Grafana « Usage IA » : équipe = $Equipe ; outils azure_*, learn_* et ceux de la cible MCP de l'équipe comptés."
Info "Remise à zéro : ./demos/D-agent-ops/reset.ps1"
