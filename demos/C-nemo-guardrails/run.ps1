<#
.SYNOPSIS
  Démo C — NeMo Guardrails derrière la passerelle : le socle standard de garde-fous. En direct.

.DESCRIPTION
  1. Le socle standard, en deux couches : regex native de la passerelle (µs), puis webhook
     vers NeMo Guardrails (secrets, IBAN, NIR, injections) ; FailClosed ; délai de 3 s.
  2. Avant : une clé d'API et un numéro de sécurité sociale passent jusqu'au modèle.
  3. Mise en place : kubectl apply — l'adaptateur NeMo et la politique qui l'appelle.
  4. Après : mêmes prompts bloqués, un prompt normal passe (latence affichée).
  5. Les décisions : compteurs de l'adaptateur (par décision, direction, règle, profil).
  6. (option -AvecPanne) adaptateur arrêté : la passerelle refuse tout — fail-closed.
  Les mêmes règles valent quel que soit le fournisseur derrière la route.

  Chaque appel à la passerelle est détaillé : requête envoyée (URL, identité du jeton Entra ID,
  corps), garde-fous traversés, réponse reçue (code, en-têtes, corps).

  Prérequis : prepare.ps1 (image de l'adaptateur dans le registre de la plateforme).

.EXAMPLE
  ./demos/C-nemo-guardrails/run.ps1
  ./demos/C-nemo-guardrails/run.ps1 -AvecPanne
#>
[CmdletBinding()]
param(
  [switch]$AvecPanne
)

. (Join-Path $PSScriptRoot "..\lib.ps1")
Assert-Tools @("az", "kubectl", "terraform")
. (Join-Path $PSScriptRoot "overlay.ps1")
$guard = Join-Path $script:RepoRoot "guardrails\deploy"

Start-Gateway
$token = Get-UserToken

# --- Affichage détaillé d'un appel à la passerelle ------------------------------
function Get-ClaimText([string]$Claim) {
  try { $v = Get-TokenClaim $token $Claim; if ($v) { return "$v" } } catch { Write-Verbose "revendication $Claim absente" }
  return "-"
}

# Envoie un prompt sur la route LLM et montre tout : requête, garde-fous traversés, réponse.
#   $Trace  : ce que la passerelle fait de cette requête, couche par couche.
#   $Expect : regex du code HTTP attendu ; $Meaning : sa lecture si conforme.
function Send-Prompt {
  param(
    [Parameter(Mandatory)][string]$Label,
    [Parameter(Mandatory)][string]$Prompt,
    [Parameter(Mandatory)][string[]]$Trace,
    [Parameter(Mandatory)][string]$Expect,
    [Parameter(Mandatory)][string]$Meaning,
    [int]$MaxTokens = 60,
    [string]$Path = "/v1"
  )
  $body = [ordered]@{ model = "llm"; max_tokens = $MaxTokens; messages = @([ordered]@{ role = "user"; content = $Prompt }) }
  $url = "$($script:Gw)$Path/chat/completions"
  Write-Host ""
  Write-Host "  ┌─ $Label" -ForegroundColor White
  Write-Host "  │ → POST $url" -ForegroundColor Gray
  Write-Host ("  │   Authorization: Bearer <jeton Entra ID, {0} caractères>" -f $token.Length) -ForegroundColor DarkGray
  Write-Host ("  │     identité : sub={0}  aud={1}" -f (Get-ClaimText "sub"), (Get-ClaimText "aud")) -ForegroundColor DarkGray
  Write-Host ("  │   corps : {0}" -f ($body | ConvertTo-Json -Depth 5 -Compress)) -ForegroundColor Gray
  Write-Host "  │ Garde-fous traversés :" -ForegroundColor Gray
  foreach ($t in $Trace) { Write-Host "  │   · $t" -ForegroundColor Yellow }

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-Http -Method POST -Url $url -Token $token -Body $body
  $sw.Stop()
  $script:LastCode = $r.Code
  $color = if ($r.Code -lt 300) { "Green" } else { "Red" }
  Write-Host ("  │ ← HTTP {0}   en {1} ms" -f $r.Code, $sw.ElapsedMilliseconds) -ForegroundColor $color
  foreach ($k in ($r.Headers.Keys | Sort-Object)) { Write-Host ("  │   {0}: {1}" -f $k, $r.Headers[$k]) -ForegroundColor DarkGray }
  $answer = $r.Body
  $usage = ""
  try {
    $d = $r.Body | ConvertFrom-Json
    if ($d.PSObject.Properties.Name -contains "choices") {
      $answer = $d.choices[0].message.content
      if ($d.PSObject.Properties.Name -contains "usage" -and $d.usage) {
        $usage = "   (jetons : {0} en entrée, {1} en sortie)" -f $d.usage.prompt_tokens, $d.usage.completion_tokens
      }
    }
  } catch { Write-Verbose "réponse non JSON" }
  $short = ($answer -replace "\s+", " ").Trim()
  if ($short.Length -gt 400) { $short = $short.Substring(0, 400) + "…" }
  $what = if ($r.Code -lt 300) { "réponse du modèle" } else { "corps renvoyé par la passerelle" }
  if ($short) { Write-Host ("  │   {0} : {1}{2}" -f $what, $short, $usage) -ForegroundColor Gray }
  else { Write-Host "  │   (corps vide)" -ForegroundColor DarkGray }
  Write-Host "  └─" -ForegroundColor White
  Expect-Code $Expect $Meaning "attendu un code $Expect, reçu $($r.Code)"
}

# Les trois prompts : ce que fait la passerelle avant / après la mise en place.
$prompts = @(
  [pscustomobject]@{
    Label = "clé d'API collée"
    Text  = "Peux-tu vérifier pourquoi cette clé ne marche pas : sk-proj-AbCdEfGhIjKlMnOpQrStUvWx123456 ?"
    Avant = @("couche 1 (regex native) : pas de numéro de carte → laisse passer",
              "aucun webhook configuré → la requête part vers le modèle, clé comprise")
    Apres = @("couche 1 (regex native) : pas de numéro de carte → laisse passer",
              "couche 2 (webhook) : POST guardrail-adapter:8080/request, en-têtes x-guardrail-profile=default et x-user=<sub du jeton>",
              "adaptateur → NeMo, règle regex_detection « clé sk-… » → RejectAction (403) : le modèle n'est PAS appelé")
  },
  [pscustomobject]@{
    Label = "numéro de sécurité sociale"
    Text  = "Rédige un courrier pour l'assuré 1 85 05 78 006 084 36 concernant son dossier."
    Avant = @("couche 1 (regex native) : pas de numéro de carte → laisse passer",
              "aucun webhook configuré → le NIR part vers le modèle (et ses journaux)")
    Apres = @("couche 1 (regex native) : pas de numéro de carte → laisse passer",
              "couche 2 (webhook) : POST guardrail-adapter:8080/request, profil default",
              "adaptateur → NeMo, règle regex_detection « NIR (15 chiffres avec clé) » → RejectAction (403) : le modèle n'est PAS appelé")
  },
  [pscustomobject]@{
    Label = "numéro de carte"
    Text  = "Ma carte 4111 1111 1111 1111 est-elle valide ?"
    Avant = @("couche 1 (regex native, numéro de carte) → refus par la passerelle elle-même",
              "le modèle n'est pas appelé : c'est la seule protection active avant la mise en place")
    Apres = @("couche 1 (regex native) : toujours en place devant le webhook",
              "couche 2 : l'adaptateur contrôle aussi les cartes (groupes de chiffres, préfixe émetteur, clé de Luhn)",
              "dans les deux cas la requête est refusée avant le modèle")
  }
)

function Test-Prompts([string]$Label, [string]$Phase) {
  foreach ($p in $prompts) {
    $blocked = ($Phase -eq "apres") -or ($p.Label -eq "numéro de carte")
    if ($blocked) { $expect = "^4"; $meaning = "refusé — la requête n'a pas atteint le modèle" }
    else { $expect = "^2"; $meaning = "passe — la donnée sensible a atteint le modèle" }
    $trace = if ($Phase -eq "avant") { $p.Avant } else { $p.Apres }
    Send-Prompt -Label "$Label — $($p.Label)" -Prompt $p.Text -Trace $trace -Expect $expect -Meaning $meaning
  }
}

# -----------------------------------------------------------------------------
Step "1 · Le socle standard de garde-fous : deux couches, une politique par route"
Info "Couche 1 — regex native de la passerelle (cartes bancaires) : microsecondes, aucune dépendance."
Info "Couche 2 — webhook vers NeMo Guardrails (bibliothèque Apache-2.0) : profil « default », sans appel LLM."
Write-Host "  ── guardrails/deploy/rails/default/config.yml" -ForegroundColor DarkGray
Show-Code ((Get-Content (Join-Path $guard "rails\default\config.yml") -Encoding UTF8 | Where-Object { $_ -notmatch "^\s*#" -and $_ -match "\S" } | Select-Object -First 24) -join "`n")
Write-Host "  ── guardrails/deploy/gateway/guardrail-policies.yaml (extrait)" -ForegroundColor DarkGray
Show-Code (@(
    "          - webhook:",
    "              backendRef: { kind: Service, name: guardrail-adapter, port: 8080 }",
    "              failureMode: FailClosed         # adaptateur injoignable => refus",
    "              headers:",
    "                x-guardrail-profile: '`"default`"'",
    "                x-user: jwt.sub               # l'identité Entra ID dans les journaux"
  ) -join "`n")
Info "+ délai de 3 s sur le webhook ; profil « strict » (auto-contrôles LLM) pour les routes grand public."
Write-Host ""
Info "Ce que la passerelle fait de chaque requête POST /v1/chat/completions :"
Info "  1. authentifie le jeton Entra ID (signature, audience) ;"
Info "  2. couche 1 : regex native sur le corps ;"
Info "  3. couche 2 : appelle l'adaptateur (/request) ; il répond Pass, Mask ou Reject ;"
Info "  4. si tout passe : envoie au fournisseur (Foundry), puis rappelle l'adaptateur (/response) sur la réponse."
Info "État actuel des politiques de garde-fous dans le cluster :"
Invoke-Native { kubectl -n $script:NsGw get agentgatewaypolicy } "politiques"
Wait-Demo

# -----------------------------------------------------------------------------
Step "2 · Avant : filtres Foundry + regex native seulement"
Info "Trois requêtes avec des données sensibles, envoyées avec votre jeton Entra ID :"
Test-Prompts "avant" "avant"
Info "Bilan : la clé et le NIR atteignent le modèle (et ses journaux) ; seule la carte est arrêtée."
Info "Et un modèle Claude dans Foundry n'a même pas les filtres de contenu Foundry."
Wait-Demo

# -----------------------------------------------------------------------------
Step "3 · Mise en place : kubectl apply (adaptateur NeMo + politique webhook)"
Info "On applique guardrails/deploy rendu pour ce cluster : image de l'adaptateur dans le registre de la"
Info "plateforme, compte et projet Foundry recopiés du backend « llm » (rien n'est écrit sur le disque)."
$yaml = Get-GuardrailsOverlay
Invoke-KubectlApply $yaml "guardrails"
Info "Attente de l'adaptateur (2 réplicas) — tant qu'il n'est pas prêt, le webhook FailClosed refuserait tout le trafic LLM :"
Invoke-Native { kubectl -n $script:NsGw rollout status deployment/guardrail-adapter --timeout=240s } "adaptateur NeMo"
Start-Sleep -Seconds 5
Info "Ce qui est maintenant en place :"
Invoke-Native { kubectl -n $script:NsGw get deployment,service -l app.kubernetes.io/name=guardrail-adapter } "adaptateur"
Invoke-Native { kubectl -n $script:NsGw get agentgatewaypolicy } "politiques"
Info "  garde-fous-llm            : regex native + webhook /request et /response, profil default, FailClosed"
Info "  guardrail-adapter-timeout : 3 s maximum par appel au webhook"
Info "  guardrails-strict         : profil strict, exemple inerte (aucune route ne le porte aujourd'hui)"
Ok "garde-fous NeMo actifs sur /v1, /agents/v1 (et toute route LLM ajoutée à la politique)"
Wait-Demo

# -----------------------------------------------------------------------------
Step "4 · Après : mêmes prompts"
Info "Mêmes requêtes, même jeton. Seul le cluster a changé."
Test-Prompts "après" "apres"

Write-Host ""
Info "Un prompt normal doit passer les deux couches, puis le modèle, puis le contrôle de la réponse :"
Send-Prompt -Label "après — prompt normal" -Prompt "Donne-moi trois idées de titres pour une conférence sur les agents IA." -MaxTokens 80 `
  -Trace @("couche 1 (regex native) : rien à signaler",
           "couche 2 (webhook /request) : profil default, aucune règle ne correspond → PassAction",
           "envoi au fournisseur (Foundry), puis webhook /response sur la réponse (clés, injections) → PassAction") `
  -Expect "^2" -Meaning "passe — de bout en bout, dont moins de 10 ms de garde-fous (rails déterministes)"
Wait-Demo

# -----------------------------------------------------------------------------
Step "5 · Les décisions : qui, quel profil, quel résultat"
Info "L'adaptateur compte chaque décision (guardrail_adapter_decisions_total) ; lecture de /metrics sur chaque réplica :"
$pods = @(Get-NativeOutput { kubectl -n $script:NsGw get pods -l app.kubernetes.io/name=guardrail-adapter -o name })
foreach ($pod in $pods) {
  Write-Host "  ── $pod" -ForegroundColor DarkGray
  $m = Get-NativeOutput { kubectl -n $script:NsGw exec $pod -- python -c "import urllib.request as u; print(u.urlopen('http://localhost:8080/metrics').read().decode())" }
  $lines = @($m | Where-Object { $_ -match "^guardrail_adapter_(decisions|errors)_total\{" })
  if ($lines.Count) { Show-Code ($lines -join "`n") } else { Info "(aucune décision sur ce réplica)" }
}
Info "Lecture : direction=request/response, action=pass|reject|mask, rail = la règle qui a déclenché, profile = default|strict."
Info "Les requêtes sont réparties entre les deux réplicas : les compteurs s'additionnent."
Info "Journaux de l'adaptateur : une ligne par refus / masquage (règle, profil, équipe, utilisateur, modèle — jamais le prompt) :"
Invoke-Native { kubectl -n $script:NsGw logs -l app.kubernetes.io/name=guardrail-adapter --prefix --tail=6 } "journaux de l'adaptateur"
Info "Tout cela est agrégé dans le dashboard Grafana « Garde-fous » (équipe × règle × profil) : monitoring/README.md."
Info "Alertes PrometheusRule si le taux de blocage s'envole ; guardrail_adapter_check_duration_seconds pour la latence."

if ($AvecPanne) {
  Wait-Demo
  Step "6 · Panne de l'adaptateur : la passerelle refuse tout (fail-closed)"
  Info "On met l'adaptateur à 0 réplica : le webhook devient injoignable."
  Invoke-Native { kubectl -n $script:NsGw scale deployment/guardrail-adapter --replicas=0 } "scale 0"
  Start-Sleep -Seconds 8
  Invoke-Native { kubectl -n $script:NsGw get deployment guardrail-adapter } "adaptateur"
  Send-Prompt -Label "panne — prompt anodin" -Prompt "Bonjour" -MaxTokens 20 `
    -Trace @("couche 1 (regex native) : rien à signaler",
             "couche 2 (webhook) : guardrail-adapter injoignable → failureMode FailClosed → refus",
             "le modèle n'est pas appelé : pas de garde-fou, pas de trafic LLM") `
    -Expect "^[45]" -Meaning "refusé — pas de garde-fou, pas de trafic LLM"
  Info "On rétablit l'adaptateur (2 réplicas) :"
  Invoke-Native { kubectl -n $script:NsGw scale deployment/guardrail-adapter --replicas=2 } "scale 2"
  Invoke-Native { kubectl -n $script:NsGw rollout status deployment/guardrail-adapter --timeout=120s } "rétabli"
  Ok "adaptateur rétabli"
}
Info "Remise à zéro (retour au regex natif seul) : ./demos/C-nemo-guardrails/reset.ps1"
