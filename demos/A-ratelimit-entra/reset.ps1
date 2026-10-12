<#
.SYNOPSIS
  Remet la démo A à zéro : supprime la route ouverte et sa politique.
#>
[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot "..\lib.ps1")
Invoke-Native { kubectl -n $script:NsGw delete agentgatewaypolicy,httproute -l app.kubernetes.io/part-of=demo-a --ignore-not-found } "suppression des objets de la démo A"
Ok "Démo A remise à zéro (route /demo/v1 et politique protection-demo supprimées)."
