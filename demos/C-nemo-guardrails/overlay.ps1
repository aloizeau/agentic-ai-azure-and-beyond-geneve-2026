<#
  Rendu de guardrails/deploy pour ce cluster, en mémoire (rien n'est écrit) :
  image de l'adaptateur dans le registre de la plateforme, compte et projet
  Foundry recopiés depuis le backend `llm` de la passerelle.
  Chargé par run.ps1 et reset.ps1 (après lib.ps1).
#>

$script:AdapterTag = if ($env:ADAPTER_TAG) { $env:ADAPTER_TAG } else { "0.1.0" }

function Get-GuardrailsOverlay {
  $login = Get-TfOutput "acr_login_server"
  $azure = (Get-KubeJson @("-n", $script:NsGw, "get", "agentgatewaybackend", "llm")).spec.ai.groups[0].providers[0].azure
  $yaml = (kubectl kustomize (Join-Path $script:RepoRoot "guardrails\deploy") | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "kubectl kustomize guardrails/deploy" }
  $yaml = $yaml.Replace("ghcr.io/OWNER/nemo-guardrail-adapter:0.1.0", "$login/plateforme/nemo-guardrail-adapter:$($script:AdapterTag)")
  $yaml = $yaml.Replace("fdy-REPLACE-ME", $azure.resourceName)
  return $yaml.Replace("proj-REPLACE-ME", $azure.projectName)
}
