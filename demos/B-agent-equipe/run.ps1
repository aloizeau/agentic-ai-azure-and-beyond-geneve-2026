<#
.SYNOPSIS
  Démo B — « Agent Ready » : l'équipe IA prépare, l'équipe de dev déploie son agent. En direct.

.DESCRIPTION
  1. Équipe IA : pipeline « Agent Ready » (workflow_dispatch, approbation « ai-team »),
     Terraform par équipe — identités fédérées, stockage, rôles, namespace, RBAC, clé
     virtuelle, dépôt GitHub standard.
  2. Preuve : ce qui a été créé dans Azure, Kubernetes et GitHub.
  3. Équipe de dev : pipeline « 1 · Image » (docker build → registre), puis
     « 2 · Déploiement » enchaîné (documents → stockage, agent dans SON namespace) —
     deux workflows de dix lignes qui appellent ceux de l'équipe IA.
  4. La passerelle a découvert le serveur MCP de l'équipe, sans configuration.
  5. LibreChat : l'agent répond depuis les documents de l'équipe.
  6. L'équipe ajoute un document et pousse : seul « 2 · Déploiement » repart.

  Prérequis : prepare.ps1 (une fois), gh et git connectés, ce dépôt cloné.

.EXAMPLE
  ./demos/B-agent-equipe/run.ps1
  ./demos/B-agent-equipe/run.ps1 -Equipe equipe-juridique
#>
[CmdletBinding()]
param(
  # -cmatch, \A…\z : sensible à la casse, pas de saut de ligne final toléré (même règle
  # que la variable equipe de terraform/teams).
  [ValidateScript({ $_ -cmatch '\A[a-z][a-z0-9-]{1,18}[a-z0-9]\z' -and $_ -notmatch '--' })]
  [string]$Equipe = "equipe-docs",
  [string]$Description = "Assistant qui répond aux questions de l'équipe à partir de ses documents"
)

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("az", "kubectl", "terraform", "gh", "git")
Push-Location $script:RepoRoot
$platformRepo = (gh repo view --json nameWithOwner --jq .nameWithOwner)
$owner = $platformRepo.Split("/")[0]
$teamRepo = "$owner/agent-$Equipe"
Pop-Location
$rg = Get-TfOutput "teams_resource_group_name"

function Show-Lines([string]$Path, [string]$From, [int]$Count) {
  $lines = Get-Content (Join-Path $script:RepoRoot $Path) -Encoding UTF8
  $i = [array]::FindIndex([string[]]$lines, [Predicate[string]] { param($l) $l -match $From })
  if ($i -lt 0) { $i = 0 }
  Write-Host "  ── $Path" -ForegroundColor DarkGray
  Show-Code (($lines[$i..([Math]::Min($i + $Count, $lines.Count) - 1)]) -join "`n")
}

# -----------------------------------------------------------------------------
Step "0 · Avant : une équipe veut son agent → un ticket, trois semaines, cinq équipes à relancer"
Info "Aujourd'hui : deux équipes, deux pipelines, deux périmètres."
Wait-Demo

Step "1 · Équipe IA : pipeline « Agent Ready » — approbation, puis Terraform pour CETTE équipe"
Show-Lines ".github/workflows/agent-ready.yml" "^on:" 22
Info "terraform/teams : 2 identités fédérées · stockage · 4 rôles · namespace, quota, clé virtuelle, RoleBinding · dépôt GitHub"
$since = Get-Date
Invoke-Native { gh workflow run agent-ready.yml --repo $platformRepo -f "equipe=$Equipe" -f "description=$Description" -f "action=apply" } "gh workflow run agent-ready"
Info "GitHub → Actions → « Agent Ready » → Review deployments → ai-team → Approve"
if (Wait-Run $platformRepo "agent-ready.yml" $since 900) { Ok "équipe $Equipe : Agent Ready" } else { Ko "Agent Ready en échec : voir le run" }
Wait-Demo

# -----------------------------------------------------------------------------
Step "2 · Preuve : Azure, Kubernetes, GitHub"
Invoke-Native { az resource list -g $rg --query "[?tags.equipe=='$Equipe'].{nom:name, type:type}" -o table } "az resource list"
Invoke-Native { az identity federated-credential list -g $rg --identity-name "id-$Equipe-pipeline" --query "[].{nom:name, sujet:subject}" -o table } "fédération pipeline"
Invoke-Native { az identity federated-credential list -g $rg --identity-name "id-$Equipe-mcp" --query "[].{nom:name, sujet:subject}" -o table } "fédération serveur MCP"
Invoke-Native { kubectl get namespace $Equipe --show-labels } "namespace"
Invoke-Native { kubectl -n $Equipe get rolebinding,resourcequota,limitrange } "objets du namespace"
Invoke-Native { gh variable list --repo $teamRepo } "variables du dépôt"
Info "dépôt : https://github.com/$teamRepo"
Wait-Demo

# -----------------------------------------------------------------------------
Step "3 · Équipe de dev : « 1 · Image » puis « 2 · Déploiement » — des workflows fournis par l'équipe IA"
Write-Host "  ── $teamRepo/.github/workflows/1-image.yml" -ForegroundColor DarkGray
Show-Code ((gh api "repos/$teamRepo/contents/.github/workflows/1-image.yml" -H "Accept: application/vnd.github.raw" | Select-Object -Skip 4) -join "`n")
$since = Get-Date
Invoke-Native { gh workflow run 1-image.yml --repo $teamRepo } "gh workflow run 1-image"
if (Wait-Run $teamRepo "1-image.yml" $since) { Ok "image poussée dans le registre (AcrPush seulement)" } else { Ko "1 · Image en échec" }
if (Wait-Run $teamRepo "2-deploiement.yml" $since) { Ok "agent déployé dans $Equipe" } else { Ko "2 · Déploiement en échec" }
Invoke-Native { kubectl -n $Equipe get deploy,svc,remotemcpserver,agent } "objets déployés"
Wait-Demo

# -----------------------------------------------------------------------------
Step "4 · La passerelle a découvert le serveur MCP de l'équipe — sans une ligne de configuration"
Start-Gateway
$token = Get-UserToken
$tools = Invoke-Mcp -Path "/mcp-equipes" -Token $token -Method "tools/list"
if ($tools.Code -eq 200 -and $tools.Result -and ($tools.Result.PSObject.Properties.Name -contains "result")) {
  $tools.Result.result.tools | ForEach-Object { Info ("outil : " + $_.name) }
  Ok "publié sur /mcp-equipes (jeton Entra ID obligatoire) → « outils-equipes » dans LibreChat"
} else { Ko "tools/list sur /mcp-equipes : HTTP $($tools.Code)" }
$anon = Invoke-Http -Method POST -Url "$($script:Gw)/mcp-equipes" -Body @{ jsonrpc = "2.0"; id = 1; method = "tools/list" }
if ($anon.Code -eq 401) { Ok "sans jeton : 401 — les outils d'une équipe héritent des règles de la plateforme" } else { Ko "sans jeton : attendu 401, reçu $($anon.Code)" }
Wait-Demo

# -----------------------------------------------------------------------------
function Ask-Agent([string]$Question) {
  $call = Invoke-Mcp -Path "/mcp" -Token $token -Method "tools/call" -Params @{
    name = "invoke_agent"; arguments = @{ agent = "$Equipe/assistant-docs"; task = $Question } }
  if ($call.Code -eq 200 -and $call.Result -and ($call.Result.PSObject.Properties.Name -contains "result")) {
    Info (($call.Result.result.content | Where-Object { $_.PSObject.Properties.Name -contains "text" } | ForEach-Object { $_.text }) -join " ")
    return $true
  }
  Ko "invoke_agent : HTTP $($call.Code)"
  return $false
}

Step "5 · LibreChat : l'agent de l'équipe répond depuis SES documents"
Info "LibreChat → outil « agents » → « Qui répond aux alertes d'astreinte, et en combien de temps ? »"
Info "Même chemin depuis ce terminal (passerelle /mcp, invoke_agent) :"
if (Ask-Agent "Qui répond aux alertes d'astreinte, et en combien de temps ?") { Ok "réponse sourcée (astreinte.md) — modèle via la passerelle, coût attribué à $Equipe" }
Wait-Demo

# -----------------------------------------------------------------------------
Step "6 · L'équipe ajoute un document et pousse : seul « 2 · Déploiement » repart"
$work = Join-Path ([IO.Path]::GetTempPath()) ("agent-$Equipe-" + (Get-Date -Format "HHmmss"))
Invoke-Native { gh repo clone $teamRepo $work -- --quiet } "gh repo clone"
$doc = @"
# Soirée du 29 octobre

- Lieu : Tesla Store Genève, rue de la Confédération 8.
- Horaires : 18 h à 21 h ; talk « IA agentique : vers Azure et au-delà ! » à 18 h 30.
- Les démos de la soirée sont dans le dépôt de la plateforme.
"@
[IO.File]::WriteAllText((Join-Path $work "docs\soiree-geneve.md"), $doc, [Text.UTF8Encoding]::new($false))
Push-Location $work
try {
  Invoke-Native { git add docs/soiree-geneve.md } "git add"
  Invoke-Native { git -c user.name="Équipe $Equipe" -c user.email="dev@$Equipe.invalid" commit -q -m "Ajoute le document de la soirée" } "git commit"
  $since = Get-Date
  Invoke-Native { git push -q } "git push"
} finally { Pop-Location }
if (Wait-Run $teamRepo "2-deploiement.yml" $since) { Ok "documents à jour — aucune image reconstruite" }
if (Ask-Agent "Où et à quelle heure a lieu la soirée du 29 octobre ?") { Ok "le nouveau document est déjà dans les réponses" }
Info "Grafana « Usage IA » : équipe = $Equipe ; outils docs-$($Equipe)_* comptés par utilisateur."
Info "Remise à zéro : ./demos/B-agent-equipe/reset.ps1 -Equipe $Equipe"
