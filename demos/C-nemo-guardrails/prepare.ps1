<#
.SYNOPSIS
  Démo C — préparation (J-1) : image de l'adaptateur NeMo Guardrails dans le registre de la plateforme.

.DESCRIPTION
  az acr build : l'image est construite dans Azure, pas sur ce poste (pas de Docker requis).
  Rien n'est appliqué au cluster : la mise en place se fait en direct (run.ps1), car le
  webhook est fail-closed — sans adaptateur prêt, tout le trafic LLM serait refusé.

.EXAMPLE
  ./demos/C-nemo-guardrails/prepare.ps1
#>
[CmdletBinding()]
param(
  [string]$Tag = "0.1.0"
)

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("az", "terraform")
$acr = Get-TfOutput "acr_name"
Step "Image plateforme/nemo-guardrail-adapter:$Tag"
Invoke-Native { az acr build --registry $acr --image "plateforme/nemo-guardrail-adapter:$Tag" (Join-Path $script:RepoRoot "guardrails\adapter") } "az acr build"
Ok "prête — run.ps1 l'utilisera (ADAPTER_TAG=$Tag)"
