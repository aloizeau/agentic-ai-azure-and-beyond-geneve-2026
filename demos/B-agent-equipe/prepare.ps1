<#
.SYNOPSIS
  Démo B — préparation, une fois : le pipeline « Agent Ready » de l'équipe IA sur GitHub.

.DESCRIPTION
  Prérequis : terraform.tfvars contient ai_team_github_repository = "<owner>/<ce dépôt>",
  puis ./scripts/deploy.ps1 (identité id-<base>-ai-team, ses droits bornés, ClusterRole
  agentic-team-provisioner, politique d'admission). gh connecté avec les droits
  d'administration sur ce dépôt.

  Ce script :
    1. donne à l'identité de l'équipe IA l'accès aux états teams/<équipe>.tfstate, et à
       eux seuls : rôle personnalisé « Agentic - etats Terraform des equipes » (actions de
       données sur les blobs, aucune action de gestion : le conteneur ne peut pas être
       supprimé), attribué sur le conteneur tfstate sous condition ABAC (chemin et préfixe
       de liste teams/). L'état de la plateforme, qui contient le kubeconfig admin et les
       secrets des applications Entra, lui reste fermé ;
       1 ter. si Terraform ne les pose pas (ai_team_manage_role_assignments = false, apply
       en CI) : ses rôles Azure — Contributor sur rg-<base>-equipes, RBAC Administrator
       sous condition. Ce script tourne alors avec VOS droits (Owner) ;
    2. crée l'environnement GitHub « ai-team », avec VOUS comme approbateur ;
    3. pose les variables du dépôt (identité, tenant, abonnement, état Terraform, et
       PLATEFORME : les sorties non sensibles de la plateforme, terraform output
       plateforme_pour_equipes) ;
    4. pose le secret AI_TEAM_GITHUB_TOKEN de l'environnement, depuis
       $env:AI_TEAM_GITHUB_TOKEN (jeton fine-grained) ou, à défaut, le jeton de votre
       session gh (portées repo, workflow, delete_repo — demandées si besoin) —
       transmis à gh par l'entrée standard, jamais écrit sur disque ;
    5. si ce dépôt est privé : autorise les dépôts du même propriétaire à appeler ses
       workflows réutilisables (agent-image.yml, agent-deploy.yml).

  Jeton de la session gh par défaut : simple, mais valable sur tous vos dépôts. Hors
  démo, préférer un jeton GitHub (fine-grained, propriétaire = celui des dépôts d'équipes), « All
  repositories », en lecture et écriture : Administration, Contents, Workflows, Variables
  et Actions — Actions sert à fixer le sujet OIDC du dépôt de l'équipe
  (PUT /repos/<owner>/<dépôt>/actions/oidc/customization/sub) ; sans lui, Agent Ready
  échoue sur github_actions_repository_oidc_subject_claim_customization_template.

.EXAMPLE
  ./demos/B-agent-equipe/prepare.ps1                                          # jeton de la session gh
  $env:AI_TEAM_GITHUB_TOKEN = "<jeton>"; ./demos/B-agent-equipe/prepare.ps1   # jeton fine-grained
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

  Step "1 · Accès de l'équipe IA aux états teams/ — et à eux seuls"
  $saId = az storage account show -n $stateAccount -g $stateRg --query id -o tsv
  if ($LASTEXITCODE -ne 0 -or -not $saId) { throw "compte d'état $stateAccount introuvable" }
  $containerScope = "$saId/blobServices/default/containers/tfstate"
  $blob = "Microsoft.Storage/storageAccounts/blobServices/containers/blobs"

  # Rôle personnalisé : les actions de données sur les blobs, et rien d'autre. Storage Blob
  # Data Contributor contient aussi des actions de gestion (containers/delete…) qu'aucune
  # condition sur les blobs ne couvre : avec lui, l'identité supprimait le conteneur tfstate.
  $roleName = "Agentic - etats Terraform des equipes"
  $roleDef = [ordered]@{
    Name             = $roleName
    IsCustom         = $true
    Description      = "Lire, écrire, supprimer les états Terraform des équipes (blobs). Aucune action de gestion."
    Actions          = @()
    NotActions       = @()
    DataActions      = @("$blob/read", "$blob/write", "$blob/delete", "$blob/add/action")
    NotDataActions   = @()
    AssignableScopes = @("/subscriptions/$subscription")
  }
  $existing = ((az role definition list --name $roleName --custom-role-only true -o json) -join "`n") | ConvertFrom-Json
  $existing = @($existing) | Select-Object -First 1
  $roleFile = [IO.Path]::GetTempFileName()
  try {
    if (-not $existing) {
      [IO.File]::WriteAllText($roleFile, ($roleDef | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
      Invoke-Native { az role definition create --role-definition "@$roleFile" -o none } "création du rôle $roleName"
    }
    elseif ((@($existing.permissions[0].dataActions | Sort-Object) -join "|") -eq (@($roleDef.DataActions | Sort-Object) -join "|") -and
            @($existing.permissions[0].actions).Count -eq 0) {
      Ok "rôle « $roleName » déjà à jour"
    }
    else {
      # Mise à jour : az attend le format de « az role definition list » (id, name =
      # GUID, roleName), pas celui de la création — sinon KeyError: 'roleName'.
      $update = [ordered]@{
        id               = $existing.id
        name             = $existing.name
        roleName         = $roleName
        roleType         = "CustomRole"
        description      = $roleDef.Description
        assignableScopes = $roleDef.AssignableScopes
        permissions      = @([ordered]@{ actions = @(); notActions = @(); dataActions = $roleDef.DataActions; notDataActions = @() })
      }
      [IO.File]::WriteAllText($roleFile, ($update | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
      Invoke-Native { az role definition update --role-definition "@$roleFile" -o none } "mise à jour du rôle $roleName"
    }
  } finally { Remove-Item $roleFile -ErrorAction SilentlyContinue }

  # Condition (Microsoft Learn, « Example: Read or list blobs in named containers with a
  # path ») : lire, écrire, ajouter, supprimer un blob sous teams/ ; lister seulement avec
  # un préfixe teams/ (terraform init : Workspaces() liste « teams/<équipe>.tfstateenv: »).
  # Sans la branche Blob.List, une liste n'a pas d'attribut path : 403 à terraform init.
  # VÉRIFIER (D-7) : terraform init / plan / apply / destroy d'une équipe passent, et
  # « az storage blob list -c tfstate --account-name <compte> --auth-mode login » (sans
  # préfixe) est refusé avec l'identité de l'équipe IA.
  $cont = "@Resource[Microsoft.Storage/storageAccounts/blobServices/containers:name] StringEquals 'tfstate'"
  $condition = @(
    "((!(ActionMatches{'$blob/read'} AND NOT SubOperationMatches{'Blob.List'}) AND !(ActionMatches{'$blob/write'}) AND !(ActionMatches{'$blob/delete'}) AND !(ActionMatches{'$blob/add/action'}))",
    "OR ($cont AND @Resource[$($blob):path] StringStartsWith 'teams/'))",
    "AND ((!(ActionMatches{'$blob/read'} AND SubOperationMatches{'Blob.List'}))",
    "OR ($cont AND @Request[$($blob):prefix] StringStartsWith 'teams/'))"
  ) -join " "

  # Les attributions des versions précédentes de ce script (Storage Blob Data Contributor
  # sur tout le compte, avec ou sans condition) : retirées.
  $old = @(az role assignment list --assignee $principalId --scope $saId --role "Storage Blob Data Contributor" --query "[].id" -o tsv)
  foreach ($id in $old) { if ($id) { Invoke-Native { az role assignment delete --ids $id -o none } "retrait de Storage Blob Data Contributor sur le compte" } }

  # Sur le conteneur : garder l'attribution dont la condition est exactement la bonne.
  $current = ((az role assignment list --assignee $principalId --scope $containerScope --role $roleName --query "[].{id:id, c:condition}" -o json) -join "`n") | ConvertFrom-Json
  $keep = $null
  foreach ($a in @($current)) {
    if (-not $a) { continue }
    if (-not $keep -and $a.c -eq $condition) { $keep = $a.id }
    else { Invoke-Native { az role assignment delete --ids $a.id -o none } "retrait d'une attribution périmée" }
  }
  if (-not $keep) {
    # Un rôle personnalisé tout juste créé met quelques secondes à être attribuable.
    $assigned = $false
    for ($i = 1; $i -le 12 -and -not $assigned; $i++) {
      $assigned = Test-Native { az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role $roleName --scope $containerScope --condition $condition --condition-version "2.0" -o none }
      if (-not $assigned) { Info "propagation du rôle personnalisé ($i/12)…"; Start-Sleep -Seconds 10 }
    }
    if (-not $assigned) { throw "attribution de « $roleName » sur $containerScope refusée" }
  }
  Ok "« $roleName » sur $stateAccount/tfstate, sous condition : teams/* seulement"

  Step "1 ter · Rôles Azure de l'identité de l'équipe IA"
  $ra = ((terraform "-chdir=$($script:TfDir)" output -json ai_team_role_assignments) -join "") | ConvertFrom-Json
  if (-not $ra) { throw "sortie ai_team_role_assignments vide : relancer ./scripts/deploy.ps1" }
  if ($ra.managed_by_terraform) {
    Ok "posés par Terraform (ai_team_manage_role_assignments = true)"
  } else {
    # L'apply en CI ne peut pas attribuer Contributor ni RBAC Administrator (il pourrait
    # sinon se rendre Owner) : vous les posez, une fois, avec vos droits d'Owner.
    $contrib = az role assignment list --assignee $principalId --scope $ra.contributor_scope --role "Contributor" --query "[0].id" -o tsv
    if (-not $contrib) {
      Invoke-Native { az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role "Contributor" --scope $ra.contributor_scope -o none } "Contributor sur rg-…-equipes"
    }
    foreach ($scope in @($ra.delegation_scopes)) {
      $current = ((az role assignment list --assignee $principalId --scope $scope --role "Role Based Access Control Administrator" --query "[].{id:id, c:condition}" -o json) -join "`n") | ConvertFrom-Json
      $keep = $null
      foreach ($a in @($current)) {
        if (-not $a) { continue }
        if (-not $keep -and $a.c -eq $ra.condition) { $keep = $a.id }
        else { Invoke-Native { az role assignment delete --ids $a.id -o none } "retrait d'un RBAC Administrator périmé" }
      }
      if (-not $keep) {
        Invoke-Native { az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role "Role Based Access Control Administrator" --scope $scope --condition $ra.condition --condition-version "2.0" -o none } "RBAC Administrator sous condition sur $scope"
      }
    }
    Ok "Contributor sur rg-…-equipes, RBAC Administrator sous condition sur $(@($ra.delegation_scopes).Count) portées"
  }

  Step "1 bis · Le périmètre d'admission refuse ce qu'il doit refuser"
  # --dry-run=server : la politique agent-ready-perimetre est évaluée, rien n'est créé.
  # Ce test vérifie la logique de la politique ; le format réel du nom d'utilisateur de
  # l'identité (object ID) se vérifie dans le pipeline (kubectl auth whoami).
  $probes = @(
    @{ What = "namespace kube-evil"; Args = @("create", "namespace", "kube-evil") },
    @{ What = "RoleBinding cluster-admin dans kube-system"; Args = @("-n", "kube-system", "create", "rolebinding", "x", "--clusterrole=cluster-admin", "--user=x") }
  )
  foreach ($p in $probes) {
    $args2 = $p.Args + @("--dry-run=server", "--as=$principalId")
    if (Test-Native { kubectl @args2 }) { Ko "accepté : $($p.What) — périmètre d'admission absent ou inopérant" } else { Ok "refusé : $($p.What)" }
  }

  Step "2 · Environnement « ai-team » (approbation obligatoire)"
  # GitHub : approbateurs d'environnement et secrets d'environnement dans un dépôt
  # privé = GitHub Enterprise. Dépôt plateforme public sinon (les dépôts d'équipes,
  # eux, restent privés).
  $info = gh repo view $repo --json "isPrivate,owner" | ConvertFrom-Json
  if ($info.isPrivate) { Info "dépôt plateforme privé : approbateurs d'environnement = GitHub Enterprise requis" }
  $me = gh api user --jq .id
  # Déploiements depuis main seulement : une branche quelconque ne peut pas demander
  # l'approbation avec un workflow modifié (l'approbateur ne voit pas le diff).
  $envBody = @{ reviewers = @(@{ type = "User"; id = [int64]$me }); deployment_branch_policy = @{ protected_branches = $false; custom_branch_policies = $true } } | ConvertTo-Json -Depth 5 -Compress
  $envBody | gh api -X PUT "repos/$repo/environments/ai-team" --input - | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "création de l'environnement ai-team refusée (dépôt privé sans GitHub Enterprise ? le rendre public)" }
  $policies = gh api "repos/$repo/environments/ai-team/deployment-branch-policies" --jq ".branch_policies[].name"
  if (@($policies) -notcontains "main") {
    Invoke-Native { gh api -X POST "repos/$repo/environments/ai-team/deployment-branch-policies" -f "name=main" -f "type=branch" | Out-Null } "politique de branche main"
  }
  Ok "approbateur : $(gh api user --jq .login) · branche autorisée : main"

  Step "3 · Variables du dépôt"
  $vars = [ordered]@{
    AI_TEAM_CLIENT_ID     = $clientId
    AZURE_TENANT_ID       = $tenant
    AZURE_SUBSCRIPTION_ID = $subscription
    TFSTATE_RG            = $stateRg
    TFSTATE_ACCOUNT       = $stateAccount
    # Sorties non sensibles de la plateforme → TF_VAR_plateforme dans agent-ready.yml.
    PLATEFORME            = ((terraform "-chdir=$($script:TfDir)" output -json plateforme_pour_equipes) -join "")
  }
  foreach ($k in $vars.Keys) {
    # Par l'entrée standard : le JSON de PLATEFORME garde ses guillemets (Windows
    # PowerShell 5.1 les retire des arguments passés aux commandes natives).
    Invoke-Native { $vars[$k] | gh variable set $k --repo $repo } "variable $k"
  }
  Ok ($vars.Keys -join ", ")

  Step "4 · Secret AI_TEAM_GITHUB_TOKEN (environnement ai-team)"
  $token = $env:AI_TEAM_GITHUB_TOKEN
  if ($token) {
    Ok "jeton fine-grained fourni (AI_TEAM_GITHUB_TOKEN)"
  } else {
    # Démo simplifiée : le jeton de la session gh. Portées requises : repo (dépôt,
    # contenu, variables, sujet OIDC), workflow (pipelines de l'équipe),
    # delete_repo (destroy de l'équipe, reset.ps1).
    $headers = Get-NativeOutput { gh api -i user }
    $line = @($headers | Where-Object { $_ -match '^x-oauth-scopes:' }) | Select-Object -First 1
    $scopes = @(([string]$line -replace '^x-oauth-scopes:\s*', '').Trim() -split ',\s*' | Where-Object { $_ })
    $missing = @("repo", "workflow", "delete_repo" | Where-Object { $scopes -notcontains $_ })
    if ($missing.Count -gt 0) {
      Info "session gh : portées manquantes ($($missing -join ', ')) — autorisation dans le navigateur"
      Invoke-Native { gh auth refresh -h github.com -s ($missing -join ",") } "gh auth refresh"
    }
    $token = ([string](Get-NativeOutput { gh auth token })).Trim()
    Info "[!] jeton de VOTRE session gh (portées repo, workflow, delete_repo sur tous vos dépôts) : plus large qu'un jeton fine-grained, à réserver à une démo. Le pipeline s'arrête si vous le révoquez (gh auth logout ne le révoque pas)."
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
