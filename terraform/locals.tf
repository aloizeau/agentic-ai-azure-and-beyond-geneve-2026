locals {
  suffix = random_string.suffix.result
  base   = "${var.name_prefix}${local.suffix}"

  tags = merge(var.tags, {
    deployedAt = timestamp()
  })

  # Public host names (var.public_exposure). null = nothing public.
  public_base = var.public_exposure == null ? null : "${var.public_exposure.subdomain}.${var.public_exposure.zone}"
  public_hosts = var.public_exposure == null ? null : {
    chat    = local.public_base
    grafana = "grafana.${local.public_base}"
    kagent  = "kagent.${local.public_base}"
    api     = "api.${local.public_base}"
  }

  # Built-in role definition GUIDs. We assign by GUID, not by name: Microsoft
  # renamed the Foundry roles (Azure AI User -> Foundry User) keeping the same
  # IDs, and explicitly recommends using the GUID while the rename rolls out.
  role_ids = {
    # Cognitive Services User. Required rather than "Cognitive Services OpenAI
    # User" because the latter only grants access to OpenAI models and returns
    # 401 on Mistral / DeepSeek / Claude served by the same Foundry account.
    cognitive_services_user = "a97b65f3-24c7-4388-baec-2e87135dc908"
    foundry_user            = "53ca6127-db72-4b80-b1b0-d745d6d5456d"
    acr_pull                = "7f951dda-4ed3-4680-a7ca-43fe172d538d"
    network_contributor     = "4d97b98b-1d4f-4787-a291-c67834d212e7"
  }
}

resource "random_string" "suffix" {
  length  = 5
  special = false
  upper   = false
  numeric = true
}
