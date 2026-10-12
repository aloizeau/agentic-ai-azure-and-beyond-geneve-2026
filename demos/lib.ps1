<#
  Fonctions communes des démos (Windows PowerShell 5.1 et PowerShell 7).
  À charger en tête de chaque script :  . (Join-Path $PSScriptRoot "..\lib.ps1")

  Outils attendus sur le poste : az (connecté), kubectl (contexte sur le cluster),
  terraform (état initialisé par scripts/deploy.ps1). Aucun bash, aucun curl, aucun python.
#>

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

# Accents corrects dans la console Windows (Windows Terminal, conhost).
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { Write-Verbose "console sans encodage modifiable" }
# Ce que PowerShell écrit sur l'entrée standard des commandes natives (YAML vers
# kubectl) : ASCII par défaut sous 5.1, les accents deviendraient des « ? ».
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$script:DemosDir = $PSScriptRoot
$script:RepoRoot = Split-Path $PSScriptRoot -Parent
$script:TfDir = Join-Path $script:RepoRoot "terraform"
$script:NsGw = "agentgateway-system"
$script:GwPort = if ($env:GW_PORT) { [int]$env:GW_PORT } else { 8080 }
$script:Gw = "http://localhost:$($script:GwPort)"
$script:LastCode = 0

# --- Affichage -------------------------------------------------------------
function Step([string]$Message) { Write-Host "`n> $Message" -ForegroundColor Cyan }
function Ok([string]$Message) { Write-Host "  [ok] $Message" -ForegroundColor Green }
function Ko([string]$Message) { Write-Host "  [x]  $Message" -ForegroundColor Red }
function Info([string]$Message) { Write-Host "  $Message" -ForegroundColor Gray }
function Show-Code([string]$Text) { Write-Host $Text -ForegroundColor DarkYellow }

# Entrée entre deux étapes ; NO_PAUSE=1 pour les répétitions.
function Wait-Demo {
  if ($env:NO_PAUSE -eq "1") { return }
  [void](Read-Host "  (Entrée pour continuer)")
}

# Les commandes natives ne lèvent pas d'exception sous Windows PowerShell :
# on vérifie le code retour.
function Invoke-Native {
  param([Parameter(Mandatory)][scriptblock]$Command, [string]$What = "commande")
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Échec : $What (code $LASTEXITCODE)" }
}

# Sonde une commande native sans échouer (stderr redirigé devient une erreur
# bloquante sous 5.1 quand ErrorActionPreference vaut Stop).
function Test-Native([scriptblock]$Command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command 2>$null | Out-Null; return ($LASTEXITCODE -eq 0) }
  finally { $ErrorActionPreference = $previous }
}

# Sortie native silencieuse mais vérifiée.
function Invoke-Quiet {
  param([Parameter(Mandatory)][scriptblock]$Command, [string]$What = "commande")
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { $out = & $Command 2>&1 }
  finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw "Échec : $What (code $LASTEXITCODE)`n$($out | Out-String)" }
}

# Sortie d'une commande native, ou $null si elle échoue (ressource absente…).
function Get-NativeOutput([scriptblock]$Command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = & $Command 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return $out
  } finally { $ErrorActionPreference = $previous }
}

function Assert-Tools([string[]]$Names) {
  foreach ($n in $Names) {
    if (-not (Get-Command $n -ErrorAction SilentlyContinue)) {
      throw "$n introuvable. winget install Microsoft.AzureCLI / Kubernetes.kubectl / Hashicorp.Terraform / GitHub.cli"
    }
  }
}

function Get-TfOutput([string]$Name) {
  $v = terraform "-chdir=$($script:TfDir)" output -raw $Name
  if ($LASTEXITCODE -ne 0) { throw "terraform output $Name : état Terraform absent ? (scripts/deploy.ps1)" }
  return $v
}

# --- Accès au cluster --------------------------------------------------------
# kubectl apply d'un YAML construit en mémoire : rien n'est écrit sur le disque.
function Invoke-KubectlApply([string]$Yaml, [string]$What = "kubectl apply") {
  $Yaml | kubectl apply -f - | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "Échec : $What" }
}

function Get-KubeJson([string[]]$KubectlArgs) {
  $raw = & kubectl @KubectlArgs -o json
  if ($LASTEXITCODE -ne 0) { throw "kubectl $($KubectlArgs -join ' ')" }
  return ($raw | Out-String | ConvertFrom-Json)
}

# Le port local répond-il ? (TCP : même comportement sous 5.1 et 7, aucune exception à interpréter)
function Test-Port([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync("127.0.0.1", $Port)
    return ($task.Wait(1000) -and $client.Connected)
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

# Port-forward en arrière-plan, mémorisé pour le nettoyage.
function Start-PortForward([string]$Namespace, [string]$Target, [int]$LocalPort, [int]$RemotePort) {
  if (Test-Port $LocalPort) { return }
  $p = Start-Process kubectl -ArgumentList @("-n", $Namespace, "port-forward", $Target, "$($LocalPort):$($RemotePort)") `
    -WindowStyle Hidden -PassThru
  Set-Content -Path (Join-Path $env:TEMP "pf-$LocalPort.pid") -Value $p.Id
  for ($i = 0; $i -lt 30; $i++) {
    if (Test-Port $LocalPort) { return }
    Start-Sleep -Milliseconds 500
  }
  throw "port-forward $Namespace/$Target → localhost:$LocalPort ne répond pas"
}

function Stop-PortForward([int]$LocalPort) {
  $f = Join-Path $env:TEMP "pf-$LocalPort.pid"
  if (Test-Path $f) {
    $procId = [int](Get-Content $f)
    Stop-Process -Id $procId -ErrorAction SilentlyContinue
    Remove-Item $f -ErrorAction SilentlyContinue
  }
}

# La passerelle est en ClusterIP : on l'atteint par port-forward.
function Start-Gateway { Start-PortForward $script:NsGw "svc/agentgateway-proxy" $script:GwPort 80 }

# Un vrai jeton d'accès Entra ID de l'utilisateur connecté, audience = l'API de
# la passerelle (Azure CLI pré-autorisée sur l'application, modules/identity).
function Get-UserToken {
  $scope = Get-TfOutput "gateway_scope"
  $t = az account get-access-token --scope $scope --query accessToken -o tsv
  if ($LASTEXITCODE -ne 0 -or -not $t) { throw "az account get-access-token a échoué (az login ?)" }
  return $t
}

# Lit une revendication du jeton (affichage seulement : la passerelle, elle, vérifie la signature).
function Get-TokenClaim([string]$Token, [string]$Claim) {
  $payload = $Token.Split(".")[1].Replace("-", "+").Replace("_", "/")
  switch ($payload.Length % 4) { 2 { $payload += "==" } 3 { $payload += "=" } }
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json
  return $json.$Claim
}

# --- Appels HTTP -------------------------------------------------------------
# HttpClient plutôt qu'Invoke-WebRequest : mêmes résultats sous 5.1 et 7, et
# aucune exception sur 401/403/429 — le code HTTP est justement ce qu'on montre.
Add-Type -AssemblyName System.Net.Http
$script:Http = [System.Net.Http.HttpClient]::new()
$script:Http.Timeout = [TimeSpan]::FromSeconds(180)

function Invoke-Http {
  param(
    [Parameter(Mandatory)][string]$Method,
    [Parameter(Mandatory)][string]$Url,
    [string]$Token,
    [string]$ApiKey,
    [object]$Body
  )
  $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Url)
  if ($Token) { $req.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token) }
  if ($ApiKey) { [void]$req.Headers.TryAddWithoutValidation("Authorization", "Bearer $ApiKey") }
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 10 -Compress
    $req.Content = [System.Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, "application/json")
  }
  $resp = $script:Http.SendAsync($req).GetAwaiter().GetResult()
  $text = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $headers = @{}
  foreach ($h in $resp.Headers) { $headers[$h.Key.ToLowerInvariant()] = ($h.Value -join ",") }
  return [pscustomobject]@{ Code = [int]$resp.StatusCode; Body = $text; Headers = $headers }
}

# Invoke-Chat <chemin> <prompt> [-Token <jeton Entra>] [-ApiKey <clé>]
# Affiche le code HTTP, le modèle qui a réellement répondu, les jetons consommés
# et la réponse (ou l'erreur renvoyée par la passerelle).
function Invoke-Chat {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Prompt,
    [string]$Token,
    [string]$ApiKey,
    [int]$MaxTokens = 120
  )
  $body = @{ model = "llm"; max_tokens = $MaxTokens; messages = @(@{ role = "user"; content = $Prompt }) }
  $r = Invoke-Http -Method POST -Url "$($script:Gw)$Path/chat/completions" -Token $Token -ApiKey $ApiKey -Body $body
  $model = if ($r.Headers.ContainsKey("x-served-model")) { $r.Headers["x-served-model"] } else { "-" }
  $usage = ""
  $answer = $r.Body
  try {
    $d = $r.Body | ConvertFrom-Json
    if ($d.PSObject.Properties.Name -contains "choices") {
      $answer = $d.choices[0].message.content
      if ($d.PSObject.Properties.Name -contains "usage" -and $d.usage) { $usage = "   jetons : $($d.usage.total_tokens)" }
    }
  } catch { Write-Verbose "réponse non JSON" }
  $color = if ($r.Code -lt 300) { "Green" } elseif ($r.Code -eq 429) { "Yellow" } else { "Red" }
  Write-Host ("  HTTP {0}   modèle servi : {1}{2}" -f $r.Code, $model, $usage) -ForegroundColor $color
  $short = ($answer -replace "\s+", " ").Trim()
  if ($short.Length -gt 300) { $short = $short.Substring(0, 300) + "…" }
  if ($short) { Info $short }
  $script:LastCode = $r.Code
  return $r.Code
}

# Expect-Code <regex> <message si conforme> <message sinon> — sur le dernier appel.
function Expect-Code([string]$Pattern, [string]$IfMatch, [string]$Otherwise) {
  if ("$($script:LastCode)" -match $Pattern) { Ok $IfMatch } else { Ko $Otherwise }
}

# --- MCP au travers de la passerelle ------------------------------------------
# Streamable HTTP : initialize → (mcp-session-id) → notifications/initialized →
# la requête. La réponse peut être du JSON ou un flux SSE (« data: {...} »).
function ConvertFrom-McpBody([string]$Body) {
  $json = $Body
  if ($Body -match "(?m)^data:") {
    $json = (($Body -split "`n") | Where-Object { $_ -like "data:*" } | Select-Object -Last 1).Substring(5).Trim()
  }
  if (-not $json) { return $null }
  return ($json | ConvertFrom-Json)
}

function Invoke-Mcp {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Token,
    [Parameter(Mandatory)][string]$Method,
    [hashtable]$Params = @{}
  )
  $url = "$($script:Gw)$Path"
  $send = {
    param($body, $session, $bearer)
    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, $url)
    $req.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $bearer)
    [void]$req.Headers.TryAddWithoutValidation("Accept", "application/json, text/event-stream")
    if ($session) { [void]$req.Headers.TryAddWithoutValidation("mcp-session-id", $session) }
    $req.Content = [System.Net.Http.StringContent]::new(($body | ConvertTo-Json -Depth 10 -Compress), [Text.Encoding]::UTF8, "application/json")
    $script:Http.SendAsync($req).GetAwaiter().GetResult()
  }
  $init = @{ jsonrpc = "2.0"; id = 1; method = "initialize"; params = @{
      protocolVersion = "2025-06-18"; capabilities = @{}; clientInfo = @{ name = "demo-powershell"; version = "1.0" } } }
  $r = & $send $init $null $Token
  $script:LastCode = [int]$r.StatusCode
  if (-not $r.IsSuccessStatusCode) { return [pscustomobject]@{ Code = [int]$r.StatusCode; Result = $null } }
  $session = $null
  $values = $null
  if ($r.Headers.TryGetValues("mcp-session-id", [ref]$values)) { $session = @($values)[0] }
  [void](& $send @{ jsonrpc = "2.0"; method = "notifications/initialized" } $session $Token)
  $r2 = & $send @{ jsonrpc = "2.0"; id = 2; method = $Method; params = $Params } $session $Token
  $script:LastCode = [int]$r2.StatusCode
  $parsed = ConvertFrom-McpBody ($r2.Content.ReadAsStringAsync().GetAwaiter().GetResult())
  return [pscustomobject]@{ Code = [int]$r2.StatusCode; Result = $parsed }
}

# --- GitHub Actions (gh) -------------------------------------------------------
# Attend le run d'un workflow démarré après $Since, puis le suit jusqu'au bout.
# gh run watch tourne dans la console (pas de tube) : l'affichage se rafraîchit
# sur place au lieu de défiler.
function Wait-Run([string]$Repo, [string]$Workflow, [datetime]$Since, [int]$TimeoutSec = 600) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $id = $null
  while (-not $id -and (Get-Date) -lt $deadline) {
    $runs = @()
    try {
      $raw = Get-NativeOutput { gh run list --repo $Repo --workflow $Workflow --limit 5 --json "databaseId,createdAt,url" }
      if ($raw) { $runs = @($raw | Out-String | ConvertFrom-Json) }
    } catch { Write-Verbose "gh run list : $_" }
    $run = @($runs | Where-Object { ([datetime]$_.createdAt).ToUniversalTime() -ge $Since.ToUniversalTime().AddSeconds(-5) }) | Select-Object -First 1
    if ($run) { $id = $run.databaseId; Info "run : $($run.url)" } else { Start-Sleep -Seconds 4 }
  }
  if (-not $id) { Ko "aucun run de $Workflow sur $Repo"; return $false }
  $p = Start-Process gh -ArgumentList @("run", "watch", "$id", "--repo", $Repo, "--exit-status", "--interval", "5") -NoNewWindow -Wait -PassThru
  return ($p.ExitCode -eq 0)
}

# Lit resource_group_name et storage_account_name de terraform/backend.hcl.
function Get-StateBackend {
  $file = Join-Path $script:TfDir "backend.hcl"
  if (-not (Test-Path $file)) { throw "terraform/backend.hcl absent : lancer ./scripts/deploy.ps1" }
  $text = Get-Content $file -Raw -Encoding UTF8
  $rg = [regex]::Match($text, 'resource_group_name\s*=\s*"([^"]+)"')
  $sa = [regex]::Match($text, 'storage_account_name\s*=\s*"([^"]+)"')
  if (-not $rg.Success -or -not $sa.Success) { throw "backend.hcl : resource_group_name ou storage_account_name introuvable" }
  return [pscustomobject]@{ ResourceGroup = $rg.Groups[1].Value; StorageAccount = $sa.Groups[1].Value }
}
