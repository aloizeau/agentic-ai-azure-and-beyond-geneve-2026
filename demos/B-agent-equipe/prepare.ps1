<#
.SYNOPSIS
  Démo B — préparation, une fois : le pipeline « Agent Ready » de l'équipe IA sur GitHub.

.DESCRIPTION
  Prérequis : terraform.tfvars contient ai_team_github_repository = "<owner>/<ce dépôt>",
  puis ./scripts/deploy.ps1 (identité id-<base>-ai-team, ses droits bornés, ClusterRole
  agentic-team-provisioner, politique d'admission). gh connecté avec les droits
  d'administration sur ce dépôt.

  Ce script :
    1. donne à l'identité de l'équipe IA l'accès à l'état Terraform (lecture de l'état
       plateforme, écriture des états teams/<équipe>.tfstate) ;
    2. crée l'environnement GitHub « ai-team », avec VOUS comme approbateur ;
    3. pose les variables du dépôt (identité, tenant, abonnement, état Terraform) ;
    4. pose le secret AI_TEAM_GITHUB_TOKEN de l'environnement, depuis
       $env:AI_TEAM_GITHUB_TOKEN ou une saisie masquée — transmis à gh par l'entrée
       standard, jamais écrit sur disque ;
    5. si ce dépôt est privé : autorise les dépôts du même propriétaire à appeler ses
       workflows réutilisables (agent-image.yml, agent-deploy.yml).

  Jeton GitHub (fine-grained, propriétaire = celui des dépôts d'équipes) :
  Administration, Contents, Workflows et Variables en écriture, « All repositories ».

.EXAMPLE
  $env:AI_TEAM_GITHUB_TOKEN = "<jeton>"; ./demos/B-agent-equipe/prepare.ps1
#>
[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("az", "gh", "terraform")
Push-Location $script:RepoRoot
try {
  Step "0 · Sorties Terraform de la plateforme"
  $clientId = Get-NativeOutput { terraform "-chdir=$($script:TfDir)" output -raw ai_team_client_id }
  $principalId = Get-NativeOutput { terraform "-chdir=$($script:TfDir)" output -raw ai_team_principal_id }
  if (-not $clientId -or -not $principalId) {
    throw "ai_team_client_id vide : renseigner ai_team_github_repository dans terraform.tfvars puis ./scripts/deploy.ps1"
  }
  $tenant = Get-TfOutput "tenant_id"
  $subscription = Get-TfOutput "subscription_id"
  $state = Get-StateBackend
  $stateRg = $state.ResourceGroup
  $stateAccount = $state.StorageAccount
  $repo = (gh repo view --json nameWithOwner --jq .nameWithOwner)
  if ($LASTEXITCODE -ne 0 -or -not $repo) { throw "gh repo view : lancer depuis le dépôt cloné, gh auth login" }
  Ok "dépôt plateforme : $repo · identité équipe IA : $clientId · état : $stateAccount"

  Step "1 · Accès de l'équipe IA à l'état Terraform"
  $saId = az storage account show -n $stateAccount -g $stateRg --query id -o tsv
  if ($LASTEXITCODE -ne 0 -or -not $saId) { throw "compte d'état $stateAccount introuvable" }
  $existing = az role assignment list --assignee $principalId --scope $saId --role "Storage Blob Data Contributor" --query "[].id" -o tsv
  if (-not $existing) {
    Invoke-Native { az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $saId -o none } "rôle sur l'état Terraform"
  }
  Ok "Storage Blob Data Contributor sur $stateAccount"

  Step "2 · Environnement « ai-team » (approbation obligatoire)"
  # GitHub : approbateurs d'environnement et secrets d'environnement dans un dépôt
  # privé = GitHub Enterprise. Dépôt plateforme public sinon (les dépôts d'équipes,
  # eux, restent privés).
  $info = gh repo view $repo --json "isPrivate,owner" | ConvertFrom-Json
  if ($info.isPrivate) { Info "dépôt plateforme privé : approbateurs d'environnement = GitHub Enterprise requis" }
  $me = gh api user --jq .id
  $envBody = @{ reviewers = @(@{ type = "User"; id = [int64]$me }); deployment_branch_policy = $null } | ConvertTo-Json -Depth 5 -Compress
  $envBody | gh api -X PUT "repos/$repo/environments/ai-team" --input - | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "création de l'environnement ai-team refusée (dépôt privé sans GitHub Enterprise ? le rendre public)" }
  Ok "approbateur : $(gh api user --jq .login)"

  Step "3 · Variables du dépôt"
  $vars = [ordered]@{
    AI_TEAM_CLIENT_ID     = $clientId
    AZURE_TENANT_ID       = $tenant
    AZURE_SUBSCRIPTION_ID = $subscription
    TFSTATE_RG            = $stateRg
    TFSTATE_ACCOUNT       = $stateAccount
  }
  foreach ($k in $vars.Keys) {
    Invoke-Native { gh variable set $k --body $vars[$k] --repo $repo } "variable $k"
  }
  Ok ($vars.Keys -join ", ")

  Step "4 · Secret AI_TEAM_GITHUB_TOKEN (environnement ai-team)"
  $token = $env:AI_TEAM_GITHUB_TOKEN
  if (-not $token) {
    $secure = Read-Host "Jeton GitHub de l'équipe IA (fine-grained)" -AsSecureString
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  }
  if (-not $token) { throw "jeton vide" }
  $token | gh secret set AI_TEAM_GITHUB_TOKEN --env ai-team --repo $repo
  if ($LASTEXITCODE -ne 0) { throw "gh secret set" }
  $token = $null
  Ok "secret posé (entrée standard de gh, rien sur disque)"

  Step "5 · Workflows réutilisables accessibles aux dépôts d'équipes"
  if ($info.isPrivate) {
    $ownerType = gh api "users/$($info.owner.login)" --jq .type
    $level = if ($ownerType -eq "Organization") { "organization" } else { "user" }
    Invoke-Native { gh api -X PUT "repos/$repo/actions/permissions/access" -f "access_level=$level" } "accès aux workflows"
    Ok "dépôt privé : accès « $level » aux workflows réutilisables"
  } else {
    Ok "dépôt public : rien à faire"
  }
  Info "Démo : ./demos/B-agent-equipe/run.ps1"
}
finally {
  Pop-Location
}
