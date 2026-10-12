<#
.SYNOPSIS
  Remet la démo D à zéro.

.DESCRIPTION
  Par défaut : supprime l'équipe (Agent Ready, action destroy — via la démo B) ; son
  dépôt part avec ses issues. -Plateforme : retire aussi ce que prepare.ps1 a publié
  (Azure MCP Server, route /agents/mcp-entreprise, ses politiques, l'identité managée
  et ses rôles). Le namespace outils-entreprise est conservé (partagé avec
  tools/enterprise).

.EXAMPLE
  ./demos/D-agent-ops/reset.ps1
  ./demos/D-agent-ops/reset.ps1 -Local -Plateforme
#>
[CmdletBinding()]
param(
  [string]$Equipe = "equipe-ops",
  [switch]$Local,
  [switch]$Plateforme
)

. (Join-Path $PSScriptRoot "..\lib.ps1")

Step "Équipe $Equipe : destroy Agent Ready"
$b = Join-Path $PSScriptRoot "..\B-agent-equipe\reset.ps1"
if ($Local) { & $b -Equipe $Equipe -Local } else { & $b -Equipe $Equipe }

if (-not $Plateforme) { return }

Step "Plateforme : Azure MCP Server, route agents, politiques"
Assert-Tools @("az", "kubectl", "terraform")
$objects = @(
  @("outils-entreprise", "deployment/azure-mcp"), @("outils-entreprise", "service/azure-mcp"),
  @("outils-entreprise", "serviceaccount/azure-mcp"), @("outils-entreprise", "networkpolicy/azure-mcp"),
  @("agentgateway-system", "httproute/mcp-entreprise-agents"),
  @("agentgateway-system", "agentgatewaypolicy/acces-agents-outils"),
  @("agentgateway-system", "agentgatewaypolicy/outils-entreprise-autorises"),
  @("agentgateway-system", "agentgatewaypolicy/outils-equipes-lecture"),
  @("agentgateway-system", "agentgatewaybackend/mcp-entreprise-agents")
)
foreach ($o in $objects) {
  Invoke-Native { kubectl -n $o[0] delete $o[1] --ignore-not-found --wait=false } "kubectl delete $($o[1])"
}
Ok "objets Kubernetes supprimés"

$rg = Get-TfOutput "resource_group_name"
$identity = "id-$($rg -replace '^rg-', '')-azure-mcp"
$principalId = Get-NativeOutput { az identity show -g $rg -n $identity --query principalId -o tsv }
if ($principalId) {
  $ids = @(Get-NativeOutput { az role assignment list --assignee $principalId --all --query "[].id" -o tsv })
  foreach ($id in $ids) { if ($id) { Invoke-Native { az role assignment delete --ids $id } "rôle $id" } }
  Invoke-Native { az identity delete -g $rg -n $identity } "az identity delete"
  Ok "identité $identity et ses rôles supprimés"
} else { Info "identité $identity absente" }
