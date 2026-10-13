<#
.SYNOPSIS
  Remet la démo B à zéro : terraform destroy de l'équipe (identités, stockage, rôles,
  namespace, clé virtuelle, dépôt GitHub).

.DESCRIPTION
  Par défaut, par le pipeline « Agent Ready » (action destroy, approbation ai-team).
  -Local : terraform destroy depuis ce poste, avec VOS droits, le kubeconfig admin et
  un jeton GitHub ($env:GITHUB_TOKEN ou saisie masquée, jamais écrit sur disque).

.EXAMPLE
  ./demos/B-agent-equipe/reset.ps1
  ./demos/B-agent-equipe/reset.ps1 -Equipe equipe-docs -Local
#>
[CmdletBinding()]
param(
  # -cmatch, \A…\z : sensible à la casse, pas de saut de ligne final toléré (même règle
  # que la variable equipe de terraform/teams).
  [ValidateScript({ $_ -cmatch '\A[a-z][a-z0-9-]{1,18}[a-z0-9]\z' -and $_ -notmatch '--' })]
  [string]$Equipe = "equipe-docs",
  [switch]$Local
)

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("gh", "terraform")

if (-not $Local) {
  Push-Location $script:RepoRoot
  try {
    $platformRepo = (gh repo view --json nameWithOwner --jq .nameWithOwner)
    $since = Get-Date
    Invoke-Native { gh workflow run agent-ready.yml --repo $platformRepo -f "equipe=$Equipe" -f "action=destroy" } "gh workflow run (destroy)"
    Info "approuver « ai-team » dans GitHub (Review deployments)"
    if (Wait-Run $platformRepo "agent-ready.yml" $since 900) { Ok "équipe $Equipe supprimée" } else { Ko "destroy en échec : voir le run" }
  } finally { Pop-Location }
  return
}

Step "terraform destroy local (teams/$Equipe.tfstate)"
Assert-Tools @("az", "kubectl")
$state = Get-StateBackend
$stateRg = $state.ResourceGroup
$stateAccount = $state.StorageAccount
Push-Location $script:RepoRoot
$platformRepo = (gh repo view --json nameWithOwner --jq .nameWithOwner)
Pop-Location
$ownToken = -not $env:GITHUB_TOKEN
if ($ownToken) {
  $secure = Read-Host "Jeton GitHub (suppression du dépôt)" -AsSecureString
  $env:GITHUB_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
$teams = Join-Path $script:TfDir "teams"
$kubeconfig = Join-Path $HOME ".kube\config"   # contexte admin : az aks get-credentials --admin
try {
  Invoke-Native { terraform "-chdir=$teams" init -input=false -reconfigure "-backend-config=resource_group_name=$stateRg" "-backend-config=storage_account_name=$stateAccount" "-backend-config=container_name=tfstate" "-backend-config=key=teams/$Equipe.tfstate" "-backend-config=use_azuread_auth=true" } "terraform init"
  # Variables par l'environnement : aucun guillemet à faire traverser à la ligne de commande.
  $env:TF_VAR_equipe = $Equipe
  $env:TF_VAR_github_owner = $platformRepo.Split("/")[0]
  $env:TF_VAR_platform_repository = $platformRepo
  $env:TF_VAR_plateforme = ((terraform "-chdir=$($script:TfDir)" output -json plateforme_pour_equipes) -join "")
  $env:TF_VAR_kubeconfig_path = $kubeconfig
  Invoke-Native { terraform "-chdir=$teams" destroy -input=false -auto-approve } "terraform destroy"
  Ok "équipe $Equipe supprimée"
} finally {
  if ($ownToken) { Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue }
  foreach ($v in "TF_VAR_equipe", "TF_VAR_github_owner", "TF_VAR_platform_repository", "TF_VAR_plateforme", "TF_VAR_kubeconfig_path") {
    Remove-Item "Env:$v" -ErrorAction SilentlyContinue
  }
}
