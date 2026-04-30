# Hetzner Migration Notes

## Current Target Environment

- Provider: Hetzner Cloud
- Server type: `CX33`
- OS: `Ubuntu 24.04`
- Region: `Helsinki`
- Public IPv4: `204.168.223.99`
- Public IPv6: `2a01:4f9:c012:2252::/64`
- Kubernetes: `k3s`

## Chosen Hostnames

- Argo CD: `argocd.204-168-223-99.nip.io`
- Socialbook: `socialbook.204-168-223-99.nip.io`
- Keycloak: `keycloak.204-168-223-99.nip.io`

## Deployment Approach

Keep the old architecture pattern, but move it to the Hetzner cluster:

- GitHub Actions builds and pushes images
- Argo CD runs inside the Hetzner `k3s` cluster
- Argo CD deploys Helm charts from this repo
- Use `helm/overrides/self-hosted/*.yaml` for Hetzner-specific configuration
- Do not use the old LTU raw manifests for Hetzner deployment

## Important Decisions

- Do not add Rancher on this server. `CX33` is sufficient for `k3s + Argo CD + Socialbook`, but Rancher would make the node unnecessarily tight.
- Keep `Traefik` as the ingress controller because it is already included with `k3s`.
- Use `cert-manager` with the `letsencrypt-prod` `ClusterIssuer`.
- Use `nip.io` hostnames for now instead of buying a domain immediately.
- Keep frontend at `1` replica for the Hetzner single-node setup.

## Repo Changes Already Made

- Backend CORS no longer depends on LTU hostnames.
- Added configurable `CORS_ALLOWED_ORIGINS` support in:
  - `backend/src/config/cors-origins.ts`
  - `backend/src/main.ts`
  - `backend/src/apps/app-bootstrap.ts`
- Self-hosted Helm overrides were updated for Hetzner-oriented deployment.
- `k8s/argocd/socialbook-apps.yaml` was updated to use the self-hosted Helm override files.

## Cluster State Reached

- `k3s` installed and running on the Hetzner server
- `cert-manager` installed
- `ClusterIssuer` `letsencrypt-prod` created
- Argo CD installed in the cluster
- Argo CD exposed publicly through ingress

## Argo CD Notes

- Username: `admin`
- Password comes from:

```bash
k3s kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
```

- Argo CD server is configured to run insecure behind Traefik ingress.
- The ingress must target `argocd-server` service port `80`, not `443`.

## Files To Treat As Old LTU-Oriented Defaults

These still contain LTU-specific values and should not be used as the deployment source for Hetzner:

- `k8s/socialbook.yaml`
- `k8s/socialbook-ingress.yaml`
- `docker-compose.yml`
- base chart values in `helm/socialbook-*/values.yaml`

## Files To Use For Hetzner Deployment

- `k8s/argocd/socialbook-apps.yaml`
- `helm/overrides/self-hosted/frontend-values.yaml`
- `helm/overrides/self-hosted/users-values.yaml`
- `helm/overrides/self-hosted/reviews-values.yaml`
- `helm/overrides/self-hosted/social-values.yaml`
- `helm/overrides/self-hosted/notifications-values.yaml`
- `helm/overrides/self-hosted/booklists-values.yaml`
- `helm/overrides/self-hosted/notifications-worker-values.yaml`
- `helm/overrides/self-hosted/ingress-values.yaml`
- `helm/overrides/self-hosted/keycloak-values.yaml`
- `helm/overrides/self-hosted/rabbitmq-values.yaml`

## Remaining Work

- Replace all `example.com` hostnames in self-hosted override files with the chosen `nip.io` hostnames.
- Replace all `CHANGE_ME` values with real secrets.
- Replace `yourdockerhub/...` placeholders with the real Docker Hub image names.
- Update GitHub Actions so image-tag writeback modifies the self-hosted Helm override files instead of the old `k8s/socialbook.yaml`.
- Apply `k8s/argocd/socialbook-apps.yaml` to the Hetzner cluster after the values are finalized.
- Verify certificates, pod startup, and public routes for:
  - Argo CD
  - Keycloak
  - Socialbook

## Quick Commands

Check cluster:

```bash
k3s kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml get nodes
k3s kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml get pods -A
```

Get Argo CD admin password:

```bash
k3s kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
```

Apply Socialbook Argo apps:

```bash
k3s kubectl apply -n argocd -f /home/alazar/Socialbook/k8s/argocd/socialbook-apps.yaml
```
