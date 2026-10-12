<#
.SYNOPSIS
  Démo C — NeMo Guardrails derrière la passerelle : le socle standard de garde-fous. En direct.

.DESCRIPTION
  1. Le socle standard, en deux couches : regex native de la passerelle (µs), puis webhook
     vers NeMo Guardrails (secrets, IBAN, NIR, injections) ; FailClosed ; délai de 3 s.
  2. Avant : une clé d'API et un numéro de sécurité sociale passent jusqu'au modèle.
  3. Mise en place : kubectl apply — l'adaptateur NeMo et la politique qui l'appelle.
  4. Après : mêmes prompts bloqués, un prompt normal passe (latence affichée).
  5. Les décisions : journaux et métriques de l'adaptateur.
  6. (option -AvecPanne) adaptateur arrêté : la passerelle refuse tout — fail-closed.
  Les mêmes règles valent quel que soit le fournisseur derrière la route.

  Prérequis : prepare.ps1 (image de l'adaptateur dans le registre de la plateforme).

.EXAMPLE
  ./demos/C-nemo-guardrails/run.ps1
  ./demos/C-nemo-guardrails/run.ps1 -AvecPanne
#>
[CmdletBinding()]
param(
  [switch]$AvecPanne
)

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("az", "kubectl", "terraform")
. (Join-Path $PSScriptRoot "overlay.ps1")
$guard = Join-Path $script:RepoRoot "guardrails\deploy"

Start-Gateway
$token = Get-UserToken
$prompts = [ordered]@{
  "clé d'API collée"         = "Peux-tu vérifier pourquoi cette clé ne marche pas : sk-proj-AbCdEfGhIjKlMnOpQrStUvWx123456 ?"
  "numéro de sécurité sociale" = "Rédige un courrier pour l'assuré 1 85 05 78 006 084 36 concernant son dossier."
  "numéro de carte"          = "Ma carte 4111 1111 1111 1111 est-elle valide ?"
}
function Test-Prompts([string]$Label) {
  foreach ($k in $prompts.Keys) {
    Info "$Label — $k"
    [void](Invoke-Chat -Path "/v1" -Prompt $prompts[$k] -Token $token -MaxTokens 60)
  }
}

# -----------------------------------------------------------------------------
Step "1 · Le socle standard de garde-fous : deux couches, une politique par route"
Info "Couche 1 — regex native de la passerelle (cartes bancaires) : microsecondes, aucune dépendance."
Info "Couche 2 — webhook vers NeMo Guardrails (bibliothèque Apache-2.0) : profil « default », sans appel LLM."
Write-Host "  ── guardrails/deploy/rails/default/config.yml" -ForegroundColor DarkGray
Show-Code ((Get-Content (Join-Path $guard "rails\default\config.yml") -Encoding UTF8 | Where-Object { $_ -notmatch "^\s*#" -and $_ -match "\S" } | Select-Object -First 24) -join "`n")
Write-Host "  ── guardrails/deploy/gateway/guardrail-policies.yaml (extrait)" -ForegroundColor DarkGray
Show-Code (@(
    "          - webhook:",
    "              backendRef: { kind: Service, name: guardrail-adapter, port: 8080 }",
    "              failureMode: FailClosed         # adaptateur injoignable => refus",
    "              headers:",
    "                x-guardrail-profile: '`"default`"'",
    "                x-user: jwt.sub               # l'identité Entra ID dans les journaux"
  ) -join "`n")
Info "+ délai de 3 s sur le webhook ; profil « strict » (auto-contrôles LLM) pour les routes grand public."
Wait-Demo

# -----------------------------------------------------------------------------
Step "2 · Avant : filtres Foundry + regex native seulement"
Test-Prompts "avant"
Info "La clé et le NIR atteignent le modèle (et ses journaux) ; seule la carte est arrêtée."
Info "Et un modèle Claude dans Foundry n'a même pas les filtres de contenu Foundry."
Wait-Demo

# -----------------------------------------------------------------------------
Step "3 · Mise en place : kubectl apply (adaptateur NeMo + politique webhook)"
$yaml = Get-GuardrailsOverlay
Invoke-KubectlApply $yaml "guardrails"
Invoke-Native { kubectl -n $script:NsGw rollout status deployment/guardrail-adapter --timeout=240s } "adaptateur NeMo"
Start-Sleep -Seconds 5
Ok "garde-fous NeMo actifs sur /v1, /agents/v1 (et toute route LLM ajoutée à la politique)"
Wait-Demo

# -----------------------------------------------------------------------------
Step "4 · Après : mêmes prompts"
Test-Prompts "après"
Info "prompt normal :"
$sw = [Diagnostics.Stopwatch]::StartNew()
[void](Invoke-Chat -Path "/v1" -Prompt "Donne-moi trois idées de titres pour une conférence sur les agents IA." -Token $token -MaxTokens 80)
$sw.Stop()
Expect-Code "^2" ("passe — {0} ms de bout en bout, dont moins de 10 ms de garde-fous (rails déterministes)" -f $sw.ElapsedMilliseconds) "attendu 200, reçu $($script:LastCode)"
Wait-Demo

# -----------------------------------------------------------------------------
Step "5 · Les décisions : qui, quel profil, quel résultat"
Invoke-Native { kubectl -n $script:NsGw logs deployment/guardrail-adapter --tail=8 } "journaux de l'adaptateur"
Info "Métriques Prometheus : guardrail_adapter_decisions_total{decision,direction,profile},"
Info "guardrail_adapter_check_duration_seconds — alertes PrometheusRule si le taux de blocage s'envole."

if ($AvecPanne) {
  Wait-Demo
  Step "6 · Panne de l'adaptateur : la passerelle refuse tout (fail-closed)"
  Invoke-Native { kubectl -n $script:NsGw scale deployment/guardrail-adapter --replicas=0 } "scale 0"
  Start-Sleep -Seconds 8
  [void](Invoke-Chat -Path "/v1" -Prompt "Bonjour" -Token $token -MaxTokens 20)
  Expect-Code "^[45]" "refusé — pas de garde-fou, pas de trafic LLM" "attendu un refus, reçu $($script:LastCode)"
  Invoke-Native { kubectl -n $script:NsGw scale deployment/guardrail-adapter --replicas=2 } "scale 2"
  Invoke-Native { kubectl -n $script:NsGw rollout status deployment/guardrail-adapter --timeout=120s } "rétabli"
  Ok "adaptateur rétabli"
}
Info "Remise à zéro (retour au regex natif seul) : ./demos/C-nemo-guardrails/reset.ps1"
