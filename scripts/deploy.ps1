<#
.SYNOPSIS
  Déploie la plateforme depuis Windows (PowerShell 7 ou Windows PowerShell 5.1).

.DESCRIPTION
  Équivalent Windows de `make up`, avec les vérifications en plus :
    1. outils (az, terraform, kubectl) et compte Azure courant — confirmation ;
    2. resource providers, modèles Foundry disponibles dans la région ;
    3. stockage de l'état Terraform (créé au premier lancement, sans clé d'accès) ;
    4. terraform.tfvars (créé s'il n'existe pas) ;
    5. phase 1 (infrastructure) : plan, confirmation, apply ;
    6. identifiants kubectl ;
    7. phase 2 (plateforme) : plan, confirmation, apply.
  Chaque plan est affiché avant d'être appliqué : rien n'est créé sans votre « oui ».

.EXAMPLE
  ./scripts/deploy.ps1
  ./scripts/deploy.ps1 -Phase1Only
  ./scripts/deploy.ps1 -WithSelfHostedModel      # KAITO + GPU (~4,16 $/h), quota GPU requis
  ./scripts/deploy.ps1 -PublicZone shift-cloud.io # exposition publique sur demos.shift-cloud.io
                                                   # (jeton Cloudflare demandé s'il n'est pas dans CLOUDFLARE_API_TOKEN)
  ./scripts/deploy.ps1 -SkipQuotaCheck            # ne vérifie ni le catalogue ni les quotas Foundry
#>
[CmdletBinding()]
param(
  [string]$Location = "swedencentral",
  [string]$Prefix = "agwpoc",
  [switch]$WithNeMo,
  [switch]$WithSelfHostedModel,
  [switch]$Phase1Only,
  [switch]$AutoApprove,
  # Saute la vérification du catalogue et des quotas Foundry (modèles déjà déployés).
  [switch]$SkipQuotaCheck,
  # Exposition publique : zone Cloudflare (ex. shift-cloud.io) et sous-domaine.
  [string]$PublicZone,
  [string]$PublicSubdomain = "demos",
  [string]$AcmeEmail
)

$ErrorActionPreference = "Stop"
$script:OwnCloudflareToken = $false
$Root = Split-Path $PSScriptRoot -Parent
$TfDir = Join-Path $Root "terraform"

function Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Ok([string]$Message) { Write-Host "    [ok] $Message" -ForegroundColor Green }
function Warn([string]$Message) { Write-Host "    [!]  $Message" -ForegroundColor Yellow }

# Native commands do not throw on failure in Windows PowerShell: check the exit code.
# Arguments like -out=file.ext are quoted on purpose: unquoted, PowerShell splits
# them at the dot and Terraform receives two arguments.
function Invoke-Native {
  param([Parameter(Mandatory)][scriptblock]$Command, [string]$What = "commande")
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Échec : $What (code $LASTEXITCODE)" }
}

# Probe a native command without failing (Windows PowerShell 5.1 turns redirected
# stderr into a terminating error when ErrorActionPreference is Stop).
function Test-Native([scriptblock]$Command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command 2>$null | Out-Null; return ($LASTEXITCODE -eq 0) }
  finally { $ErrorActionPreference = $previous }
}

function Confirm-Step([string]$Question) {
  if ($AutoApprove) { return }
  $answer = Read-Host "$Question (oui/non)"
  if ($answer -notin @("oui", "o", "yes", "y")) { throw "Arrêt demandé." }
}

# -----------------------------------------------------------------------------
Step "Outils"
foreach ($cmd in "az", "terraform", "kubectl") {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "$cmd introuvable. Installation : winget install Microsoft.AzureCLI / Hashicorp.Terraform / Kubernetes.kubectl"
  }
}
Ok ((terraform version | Select-Object -First 1) -join "")
Ok ("kubectl " + ((kubectl version --client -o json | ConvertFrom-Json).clientVersion.gitVersion))
Ok ("az " + ((az version -o json | ConvertFrom-Json).'azure-cli'))

# -----------------------------------------------------------------------------
Step "Compte Azure"
$account = az account show -o json | ConvertFrom-Json
if (-not $account) { throw "Pas de session Azure : lancez az login." }
$me = az ad signed-in-user show -o json | ConvertFrom-Json
Write-Host ("    Abonnement : {0} ({1})" -f $account.name, $account.id)
Write-Host ("    Tenant     : {0}" -f $account.tenantId)
Write-Host ("    Compte     : {0}" -f $me.userPrincipalName)
Write-Host ("    Région     : {0}" -f $Location)
Write-Host  "    Coût       : ~0,37 $/h pour les nœuds AKS + l'inférence consommée. Pensez à ./scripts/destroy.ps1."
Confirm-Step "Déployer dans cet abonnement ?"

# -----------------------------------------------------------------------------
Step "Resource providers"
$providers = "Microsoft.ContainerService", "Microsoft.Compute", "Microsoft.CognitiveServices", "Microsoft.OperationalInsights",
"Microsoft.OperationsManagement", "Microsoft.ManagedIdentity", "Microsoft.Storage", "Microsoft.Network", "Microsoft.Insights"
foreach ($ns in $providers) {
  $state = az provider show -n $ns --query registrationState -o tsv
  if ($state -ne "Registered") {
    Warn "$ns : $state — enregistrement lancé"
    Invoke-Native { az provider register -n $ns -o none } "az provider register $ns"
  }
  else { Ok $ns }
}

# -----------------------------------------------------------------------------
Step "Modèles Microsoft Foundry en $Location"
if ($SkipQuotaCheck) {
  Warn "vérification sautée (-SkipQuotaCheck) : un modèle absent ou un quota insuffisant fera échouer terraform apply"
}
else {
  $catalog = az cognitiveservices model list -l $Location -o json | ConvertFrom-Json
  $usage = az cognitiveservices usage list -l $Location -o json | ConvertFrom-Json
  $wanted = @(
    @{ Name = "gpt-5.6-sol"; Sku = "GlobalStandard"; Quota = "OpenAI.GlobalStandard.gpt-5.6-sol"; Capacity = 50 },
    @{ Name = "gpt-5.6-terra"; Sku = "DataZoneStandard"; Quota = "OpenAI.DataZoneStandard.gpt-5.6-terra"; Capacity = 50 },
    @{ Name = "gpt-5.6-luna"; Sku = "DataZoneStandard"; Quota = "OpenAI.DataZoneStandard.gpt-5.6-luna"; Capacity = 50 },
    @{ Name = "model-router"; Sku = "DataZoneStandard"; Quota = "OpenAI.DataZoneStandard.ModelRouter"; Capacity = 50 },
    @{ Name = "MAI-Image-2.6"; Sku = "GlobalStandard"; Quota = "AIServices.GlobalStandard.MAI-Image-2.6"; Capacity = 1 }
  )
  $missing = 0
  $insufficient = 0

  # Relance : les déploiements déjà créés par cette solution consomment déjà leur
  # quota, et terraform apply les conserve. Leur capacité compte donc comme
  # disponible. Compte Foundry fdy-<préfixe><suffixe>, préfixe lu dans
  # terraform.tfvars s'il existe (c'est lui que Terraform utilisera).
  $tfvarsFile = Join-Path $TfDir "terraform.tfvars"
  $quotaPrefix = $Prefix
  if (Test-Path $tfvarsFile) {
    $m = Select-String -Path $tfvarsFile -Pattern '^\s*name_prefix\s*=\s*"([^"]+)"' | Select-Object -First 1
    if ($m) { $quotaPrefix = $m.Matches[0].Groups[1].Value }
  }
  $region = $Location.ToLower().Replace(" ", "")
  $existing = @()
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $accounts = @(az cognitiveservices account list -o json 2>$null | ConvertFrom-Json |
      Where-Object { $_.name -like "fdy-$quotaPrefix*" -and $_.location -eq $region })
    foreach ($a in $accounts) {
      $deps = az cognitiveservices account deployment list -g $a.resourceGroup -n $a.name -o json 2>$null | ConvertFrom-Json
      $n = 0
      if ($deps) { $existing += @($deps); $n = @($deps).Count }
      Ok ("compte {0} existant · {1} déploiement(s), capacité comptée comme disponible" -f $a.name, $n)
    }
  }
  catch { Warn "déploiements existants illisibles : $($_.Exception.Message)" }
  finally { $ErrorActionPreference = $previous }

  foreach ($w in $wanted) {
    $hit = $catalog | Where-Object { $_.model.name -eq $w.Name -and ($_.model.skus.name -contains $w.Sku) }
    if ($hit) { Ok ("{0} · {1}" -f $w.Name, $w.Sku) }
    else { Warn ("{0} · {1} absent du catalogue de la région" -f $w.Name, $w.Sku); $missing++ }

    $quota = $usage | Where-Object { $_.name.value -eq $w.Quota } | Select-Object -First 1
    $available = if ($quota) { [decimal]$quota.limit - [decimal]$quota.currentValue } else { 0 }
    $deployed = [decimal]0
    foreach ($d in $existing) {
      if ($d.properties.model.name -eq $w.Name -and $d.sku.name -eq $w.Sku) { $deployed += [decimal]$d.sku.capacity }
    }
    if ($deployed -gt 0) {
      Ok ("quota {0} · {1}K déjà déployés par la solution, {2}K libres" -f $w.Name, $deployed, $available)
    }
    elseif ($available -ge $w.Capacity) {
      Ok ("quota {0} · {1}K TPM libres" -f $w.Name, $available)
    }
    else {
      Warn ("quota {0} · {1}K TPM libres, {2}K requis" -f $w.Name, $available, $w.Capacity)
      $insufficient++
    }
  }
  if ($missing -gt 0) {
    Warn "Un modèle manque : le déploiement Foundry correspondant échouera. Ajustez model_deployments dans terraform.tfvars."
    Confirm-Step "Continuer quand même ?"
  }
  if ($insufficient -gt 0) {
    Warn "$insufficient quota(s) Foundry insuffisant(s) : terraform apply échouera sur ces déploiements. Ajustez model_deployments, demandez une augmentation, ou relancez avec -SkipQuotaCheck."
    Confirm-Step "Continuer quand même ?"
  }
}

# -----------------------------------------------------------------------------
Step "État Terraform"
$backendFile = Join-Path $TfDir "backend.hcl"
if (Test-Path $backendFile) {
  Ok "backend.hcl existant — réutilisé"
}
else {
  $stateRg = "rg-$Prefix-tfstate"
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $hash = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($account.id)) | ForEach-Object { $_.ToString("x2") })
  $sa = ("st{0}tf{1}" -f ($Prefix -replace "[^a-z0-9]", ""), $hash.Substring(0, 8))
  if ($sa.Length -gt 24) { $sa = $sa.Substring(0, 24) }

  Invoke-Native { az group create -n $stateRg -l $Location -o none } "création du groupe $stateRg"
  if (-not (Test-Native { az storage account show -n $sa -g $stateRg -o none })) {
    Invoke-Native {
      az storage account create -n $sa -g $stateRg -l $Location --sku Standard_ZRS --kind StorageV2 `
        --min-tls-version TLS1_2 --allow-blob-public-access false --allow-shared-key-access false -o none
    } "création du compte de stockage $sa"
  }
  $saId = az storage account show -n $sa -g $stateRg --query id -o tsv
  Test-Native {
    az role assignment create --assignee-object-id $me.id --assignee-principal-type User `
      --role "Storage Blob Data Contributor" --scope $saId -o none
  } | Out-Null

  # RBAC takes a minute to propagate: retry the first data-plane call.
  $created = $false
  for ($i = 1; $i -le 12 -and -not $created; $i++) {
    if (Test-Native { az storage container create -n tfstate --account-name $sa --auth-mode login -o none }) { $created = $true } else { Write-Host "    attente de la propagation RBAC ($i/12)…"; Start-Sleep -Seconds 15 }
  }
  if (-not $created) { throw "Impossible de créer le conteneur tfstate sur $sa (droits RBAC pas encore propagés ?). Relancez le script dans quelques minutes." }

  @(
    "resource_group_name  = `"$stateRg`""
    "storage_account_name = `"$sa`""
    "container_name       = `"tfstate`""
    "key                  = `"agentic-platform.tfstate`""
    "use_azuread_auth     = true"
  ) | Set-Content -Path $backendFile -Encoding ascii
  Ok "état sur $sa/tfstate (backend.hcl écrit, ignoré par git)"
}

# -----------------------------------------------------------------------------
Step "Variables"
$tfvars = Join-Path $TfDir "terraform.tfvars"
if (Test-Path $tfvars) {
  Ok "terraform.tfvars existant — utilisé tel quel"
}
else {
  @(
    "subscription_id           = `"$($account.id)`""
    "name_prefix               = `"$Prefix`""
    "location                  = `"$Location`""
    "enable_nemo_guardrails    = $($WithNeMo.IsPresent.ToString().ToLower())"
    "enable_self_hosted_models = $($WithSelfHostedModel.IsPresent.ToString().ToLower())"
  ) | Set-Content -Path $tfvars -Encoding ascii
  Ok "terraform.tfvars créé (ignoré par git)"
}
# -PublicZone ajoute le bloc public_exposure s'il n'y est pas encore.
$hasPublic = Select-String -Path $tfvars -Pattern '^\s*public_exposure\s*=' -Quiet
if ($PublicZone -and -not $hasPublic) {
  $block = @("", "public_exposure = {", "  zone      = `"$PublicZone`"", "  subdomain = `"$PublicSubdomain`"")
  if ($AcmeEmail) { $block += "  acme_email = `"$AcmeEmail`"" }
  $block += "}"
  Add-Content -Path $tfvars -Value $block -Encoding ascii
  $hasPublic = $true
  Ok "public_exposure ajouté : $PublicSubdomain.$PublicZone"
}
Get-Content $tfvars | ForEach-Object { Write-Host "    $_" }

# -----------------------------------------------------------------------------
if ($hasPublic) {
  Step "Cloudflare (exposition publique)"
  if ($PSVersionTable.PSVersion.Major -lt 6) { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 }
  # Jamais écrit sur disque. Saisi ici, il est retiré de l'environnement à la
  # fin du script (bloc finally plus bas) — et dès maintenant si la
  # vérification échoue : les commandes lancées ensuite dans cette session
  # PowerShell n'en héritent pas.
  if (-not $env:CLOUDFLARE_API_TOKEN) {
    $secure = Read-Host "Jeton d'API Cloudflare (Zone:Read + DNS:Edit sur la zone)" -AsSecureString
    $env:CLOUDFLARE_API_TOKEN = [System.Net.NetworkCredential]::new("", $secure).Password
    $script:OwnCloudflareToken = $true
  }
  try {
    $headers = @{ Authorization = "Bearer $($env:CLOUDFLARE_API_TOKEN)" }
    $zoneName = if ($PublicZone) { $PublicZone } else {
      ((Select-String -Path $tfvars -Pattern 'zone\s*=\s*"([^"]+)"').Matches | Select-Object -First 1).Groups[1].Value
    }
    try { $zones = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=$zoneName" -Headers $headers }
    catch { throw "Jeton Cloudflare refusé : $($_.Exception.Message)" }
    if (@($zones.result).Count -ne 1) { throw "Zone $zoneName introuvable avec ce jeton (droit Zone:Read manquant ?)." }
    Ok "jeton Cloudflare valide, zone $zoneName accessible"
  }
  catch {
    if ($script:OwnCloudflareToken) { Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue }
    throw
  }
  finally { $headers = $null }
}

# -----------------------------------------------------------------------------
Push-Location $TfDir
try {
  Step "terraform init"
  Invoke-Native { terraform init -input=false -upgrade "-backend-config=backend.hcl" } "terraform init"

  Step "terraform validate"
  Invoke-Native { terraform validate } "terraform validate"

  Step "Phase 1 — infrastructure (plan)"
  Invoke-Native { terraform plan -input=false "-out=phase1.tfplan" } "terraform plan (phase 1)"
  Confirm-Step "Appliquer la phase 1 ?"
  Invoke-Native { terraform apply -input=false phase1.tfplan } "terraform apply (phase 1)"

  Step "Identifiants kubectl"
  # Names read from the state, passed as separate arguments: nothing from the
  # state is ever executed as a command line.
  $aksRg = terraform output -raw resource_group_name
  $aksName = terraform output -raw aks_cluster_name
  Invoke-Native { az aks get-credentials --resource-group $aksRg --name $aksName --admin --overwrite-existing } "az aks get-credentials"
  Invoke-Native { kubectl get nodes -o wide } "kubectl get nodes"

  if ($Phase1Only) { Step "Phase 1 terminée (-Phase1Only)."; return }

  Step "Phase 2 — plateforme (plan)"
  Invoke-Native { terraform plan -input=false -var deploy_platform=true "-out=phase2.tfplan" } "terraform plan (phase 2)"
  Confirm-Step "Appliquer la phase 2 ?"

  # Politiques d'admission posées avec kubectl par une version précédente : absentes
  # de l'état, kubernetes_manifest refuserait de les créer (« already exists »).
  # Celles qui ne sont pas dans l'état sont supprimées juste avant l'apply, qui les
  # recrée aussitôt (quelques secondes sans ces politiques : acceptable pour un
  # cluster de démo). Celles que Terraform gère déjà ne sont pas touchées.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { $inState = @(terraform state list 2>$null) } finally { $ErrorActionPreference = $previous }
  foreach ($name in "agent-ready-perimetre", "equipes-services") {
    foreach ($kind in "ValidatingAdmissionPolicy", "ValidatingAdmissionPolicyBinding") {
      $address = "module.platform[0].kubernetes_manifest.admission[`"$kind/$name`"]"
      if ($inState -contains $address) { continue }
      $resource = $kind.ToLower()
      if (Test-Native { kubectl get $resource $name }) {
        Warn "$kind/$name présente dans le cluster mais pas dans l'état Terraform : supprimée, Terraform la recrée"
        Invoke-Native { kubectl delete $resource $name --ignore-not-found } "kubectl delete $kind/$name"
      }
    }
  }

  Invoke-Native { terraform apply -input=false phase2.tfplan } "terraform apply (phase 2)"

  Step "État du cluster"
  kubectl get pods -A --field-selector=status.phase!=Succeeded
  terraform output estimated_monthly_cost_usd

  Step "Suite"
  if ($hasPublic) {
    Write-Host "    Accès publics (certificats Let's Encrypt : quelques minutes au premier déploiement) :"
    terraform output -json public_urls | ConvertFrom-Json | Format-List | Out-String | Write-Host
    Write-Host "    Certificats : kubectl -n agentgateway-system get certificate"
  }
  Write-Host "    LibreChat : kubectl -n librechat port-forward svc/librechat 3080:3080   puis http://localhost:3080"
  Write-Host "    Grafana   : kubectl -n monitoring port-forward svc/kps-grafana 3000:80"
  Write-Host "    Démos     : demos/README.md (talk 45 min : PowerShell ; deck Chalet : bash, Git Bash ou WSL)"
  Write-Host "    Démo B    : ./demos/B-agent-equipe/prepare.ps1 (une fois ; jeton GitHub demandé, jamais écrit sur disque)"
  Write-Host "    Tout détruire : ./scripts/destroy.ps1"
}
finally {
  if ($script:OwnCloudflareToken) { Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue }
  Remove-Item -ErrorAction SilentlyContinue phase1.tfplan, phase2.tfplan
  Pop-Location
}
