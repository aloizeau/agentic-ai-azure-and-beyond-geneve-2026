# Démo A — La plateforme en un apply (vidéo)

**Format:** pre-recorded, sped-up video (a real apply takes 15–20 min). Record it at the final rehearsal with the exact tfvars used on stage.

## Record

```bash
cd terraform
terraform init -backend-config=backend.hcl
time make up            # phase 1, kubectl credentials, phase 2
make cost
kubectl get pods -A | grep -E 'agentgateway|kagent|librechat|kps'
kubectl -n librechat port-forward svc/librechat 3080:3080   # then sign in, ask a question (agents are reachable only if listed in gateway/deploy/autorisations-mcp.yaml)
```

## Narrate over it

1. `module.foundation`, `module.ai`, `module.identity`: the only Azure-specific modules. On EKS or another cloud these three change; `module.platform` does not.
2. No secret anywhere: GitHub Actions uses OIDC, workloads use Workload Identity, Foundry has `local_auth_enabled = false`.
3. Two phases because the Helm/Kubernetes providers need a cluster that exists.
4. `make down` after every session: ≈ 0.41 USD/hour while it runs.

Fallback if the video fails: show `terraform state list | head -40` on a pre-deployed environment.
