# Demo lifecycle. The node pool costs ~0.41 USD/h, so `down` matters as much as `up`.
SHELL := /bin/bash
TF    := terraform

.PHONY: help init fmt validate plan up platform down creds cost

help:
	@grep -E '^[a-z-]+:.*?##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n",$$1,$$2}'

init: ## terraform init
	$(TF) init -upgrade

fmt: ## rewrite files to canonical format
	$(TF) fmt -recursive

validate: ## static validation
	$(TF) init -backend=false -upgrade && $(TF) validate

plan: ## plan phase 1 (infrastructure)
	$(TF) plan -out=tfplan

up: ## apply phase 1, then phase 2
	$(TF) apply -auto-approve
	$(MAKE) creds
	$(TF) apply -auto-approve -var deploy_platform=true

platform: ## apply phase 2 only
	$(TF) apply -auto-approve -var deploy_platform=true

creds: ## point kubectl at the cluster
	@eval "$$($(TF) output -raw aks_get_credentials)"

down: ## destroy everything
	$(TF) destroy -auto-approve

cost: ## show the estimate
	@$(TF) output estimated_monthly_cost_usd
