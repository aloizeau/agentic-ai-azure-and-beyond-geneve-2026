<#
.SYNOPSIS
  Détruit la plateforme (équivalent Windows de `make down`).
  Le stockage de l'état Terraform (rg-<prefix>-tfstate) est conservé.
#>
[CmdletBinding()]
param([switch]$AutoApprove)

$ErrorActionPreference = "Stop"
$ownCloudflareToken = $false
$TfDir = Join-Path (Split-Path $PSScriptRoot -Parent) "terraform"

$account = az account show -o json | ConvertFrom-Json
Write-Host ("Abonnement : {0} ({1})" -f $account.name, $account.id) -ForegroundColor Cyan

# The Cloudflare DNS records are destroyed too: the token is needed then.
$tfvars = Join-Path $TfDir "terraform.tfvars"
if ((Test-Path $tfvars) -and (Select-String -Path $tfvars -Pattern '^\s*public_exposure\s*=' -Quiet) -and -not $env:CLOUDFLARE_API_TOKEN) {
  $secure = Read-Host "Jeton d'API Cloudflare (pour supprimer les enregistrements DNS)" -AsSecureString
  $env:CLOUDFLARE_API_TOKEN = [System.Net.NetworkCredential]::new("", $secure).Password
  $ownCloudflareToken = $true   # retiré de l'environnement en fin de script
}

Push-Location $TfDir
try {
  terraform init -input=false "-backend-config=backend.hcl" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "terraform init a échoué" }

  # Best effort: kubectl access lets the KAITO Workspace be released cleanly.
  $ErrorActionPreference = "Continue"
  $aksRg = terraform output -raw resource_group_name 2>$null
  $aksName = terraform output -raw aks_cluster_name 2>$null
  if ($LASTEXITCODE -eq 0 -and $aksRg -and $aksName) {
    az aks get-credentials --resource-group $aksRg --name $aksName --admin --overwrite-existing 2>$null | Out-Null
  }
  $ErrorActionPreference = "Stop"

  if (-not $AutoApprove) {
    $answer = Read-Host "Tout détruire dans cet abonnement ? (oui/non)"
    if ($answer -notin @("oui", "o", "yes", "y")) { Write-Host "Rien n'a été détruit."; return }
  }
  terraform destroy -input=false -auto-approve -var deploy_platform=true
  if ($LASTEXITCODE -ne 0) { throw "terraform destroy a échoué — relancez le script." }
  Write-Host "Détruit. L'état reste dans rg-*-tfstate (quelques centimes par mois)." -ForegroundColor Green
}
finally {
  Pop-Location
  if ($ownCloudflareToken) { Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue }
}
