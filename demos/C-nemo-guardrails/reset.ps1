<#
.SYNOPSIS
  Remet la démo C à zéro : retire NeMo Guardrails, rétablit la politique regex native seule.
#>
[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("kubectl", "terraform")
. (Join-Path $PSScriptRoot "overlay.ps1")

Step "Retrait de l'adaptateur et des politiques NeMo"
(Get-GuardrailsOverlay) | kubectl delete --ignore-not-found -f - | Out-Host

Step "Politique garde-fous-llm d'origine (regex native, gateway/deploy/policies.yaml)"
$docs = (Get-Content (Join-Path $script:RepoRoot "gateway\deploy\policies.yaml") -Raw -Encoding UTF8) -split "(?m)^---\s*$"
$core = $docs | Where-Object { $_ -match "(?m)^\s+name:\s+garde-fous-llm\s*$" } | Select-Object -First 1
if (-not $core) { throw "garde-fous-llm introuvable dans gateway/deploy/policies.yaml" }
Invoke-KubectlApply ($core -replace "(?m)^metadata:\s*$", "metadata:`n  namespace: $($script:NsGw)") "garde-fous-llm"
Ok "Démo C remise à zéro."
