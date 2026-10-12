<#
.SYNOPSIS
  Démo A — stopper l'usage illimité d'un LLM : jeton Entra ID + plafond. En direct.

.DESCRIPTION
  On part d'une route ouverte (aucune politique), puis on ajoute, en direct :
    1. rien : n'importe qui consomme, sans limite ;
    2. un jeton Entra ID obligatoire : sans jeton, 401 — avec, la passerelle sait qui appelle ;
    3. un plafond de jetons LLM par minute : 429, la dépense s'arrête d'elle-même ;
    4. le tableau de bord « Usage IA » : qui a consommé quoi.
  Deux objets Kubernetes, rien d'autre : une HTTPRoute et une AgentgatewayPolicy.

.EXAMPLE
  ./demos/A-ratelimit-entra/run.ps1
  $env:NO_PAUSE = "1"; ./demos/A-ratelimit-entra/run.ps1   # répétition sans pauses
#>
[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("az", "kubectl", "terraform")
$here = $PSScriptRoot

# Les valeurs du fournisseur d'identité sont celles de la plateforme (acces-llm).
function Get-PolicyYaml([string]$File) {
  $jwt = (Get-KubeJson @("-n", $script:NsGw, "get", "agentgatewaypolicy", "acces-llm")).spec.traffic.jwtAuthentication.providers[0]
  $yaml = Get-Content (Join-Path $here $File) -Raw -Encoding UTF8
  $yaml = $yaml.Replace("__ISSUER__", $jwt.issuer)
  $yaml = $yaml.Replace("__AUDIENCE__", [string]$jwt.audiences[0])
  return $yaml.Replace("__JWKS__", $jwt.jwks.remote.url)
}

function Show-Yaml([string]$File, [string]$From) {
  $lines = Get-Content (Join-Path $here $File) -Encoding UTF8
  $start = if ($From) { [array]::FindIndex([string[]]$lines, [Predicate[string]] { param($l) $l -match $From }) } else { 0 }
  if ($start -lt 0) { $start = 0 }
  Show-Code (($lines[$start..($lines.Count - 1)] | Where-Object { $_ -notmatch '^\s*#' }) -join "`n")
}

Start-Gateway
$prompt = "En deux phrases : pourquoi faut-il gouverner l'accès aux LLM ?"

# -----------------------------------------------------------------------------
Step "0 · Une route ouverte « pour aller vite » : même modèle, aucune politique"
Show-Yaml "1-route-ouverte.yaml" "^apiVersion"
Invoke-Native { kubectl apply -f (Join-Path $here "1-route-ouverte.yaml") } "route ouverte"
Start-Sleep -Seconds 3
Wait-Demo

Step "1 · Sans jeton, sans limite : n'importe qui consomme"
for ($i = 1; $i -le 3; $i++) {
  Info "appel $i — anonyme"
  [void](Invoke-Chat -Path "/demo/v1" -Prompt $prompt)
}
Expect-Code "^2" "le modèle répond à tout le monde — la facture aussi" "attendu 200, reçu $($script:LastCode)"
Info "« Vendredi soir, la clé fuit… » : rien dans ce chemin ne sait qui appelle ni combien."
Wait-Demo

# -----------------------------------------------------------------------------
Step "2 · Un jeton Entra ID obligatoire — une politique, attachée à la route"
Show-Yaml "2-jeton-entra.yaml" "^spec:"
Invoke-KubectlApply (Get-PolicyYaml "2-jeton-entra.yaml") "politique jeton Entra"
Start-Sleep -Seconds 3

Info "sans jeton :"
[void](Invoke-Chat -Path "/demo/v1" -Prompt $prompt)
Expect-Code "^401$" "401 — refusé à la porte, le modèle n'est jamais appelé" "attendu 401, reçu $($script:LastCode)"

$token = Get-UserToken
Info ("avec mon jeton Entra ID ({0}) :" -f (Get-TokenClaim $token "preferred_username"))
[void](Invoke-Chat -Path "/demo/v1" -Prompt $prompt -Token $token)
Expect-Code "^2" "accepté — et la passerelle sait désormais QUI consomme" "attendu 200, reçu $($script:LastCode)"
Wait-Demo

# -----------------------------------------------------------------------------
Step "3 · Un plafond : 400 jetons LLM par minute sur cette route"
Show-Yaml "3-plafond.yaml" "rateLimit"
Invoke-KubectlApply (Get-PolicyYaml "3-plafond.yaml") "plafond"
Start-Sleep -Seconds 3
$hit = $false
for ($i = 1; $i -le 8; $i++) {
  Info "appel $i"
  [void](Invoke-Chat -Path "/demo/v1" -Prompt "Écris trois phrases sur les Alpes suisses." -Token $token -MaxTokens 150)
  if ($script:LastCode -eq 429) { $hit = $true; break }
}
if ($hit) { Ok "429 — la dépense s'arrête d'elle-même" } else { Ko "pas de 429 : le plafond est-il appliqué ? (kubectl -n $($script:NsGw) get agentgatewaypolicy protection-demo -o yaml)" }
Info "« … et lundi matin, on a une alerte, pas une facture. »"
Wait-Demo

# -----------------------------------------------------------------------------
Step "4 · Qui a consommé quoi : tableau de bord « Usage IA » (Grafana, dossier Plateforme IA)"
Info "http://localhost:3000/d/usage-ia — filtre Utilisateur = votre compte Entra ID :"
Info "les appels authentifiés, leur coût, les 401 (anonymes) et le 429."
Info "Grafana : kubectl -n monitoring port-forward svc/kps-grafana 3000:80"
Info "Remise à zéro : ./demos/A-ratelimit-entra/reset.ps1"
