# Socialbook

Minimalized repository layout focused on the deployable application and monitoring stack.

## Structure

- `apps/backend` - NestJS backend source
- `apps/frontend` - React frontend source
- `deploy/backend` - one reusable backend Helm chart plus per-service values
- `deploy/frontend` - frontend Helm chart with ingress
- `deploy/ingress` - ingress routing for the live site
- `deploy/prometheus` - Prometheus Helm chart
- `deploy/grafana` - Grafana Helm chart
- `deploy/argocd` - Argo CD applications wiring the charts together

## New Repo Bootstrap

- Update repo URLs only if you move away from `https://github.com/a-l-a-z-a-r/Socialbook-done.git`
- Apply `deploy/argocd/bootstrap-app.yaml` to let Argo CD manage this repo
- Push this reduced repo to the new Git repository before syncing Argo CD

## Backend Releases

The backend chart is reused for these services, but each service now has its own image:

- `socialbook-reviews`
- `socialbook-users`
- `socialbook-social`
- `socialbook-notifications`
- `socialbook-booklists`

Service-specific values live in `deploy/backend/values`.

## Notes

- MongoDB is expected to run outside Kubernetes.
- Keycloak and RabbitMQ are no longer part of this repository.
- Old `socialbook-mongo-*` and `socialbook-notifications-worker` Argo CD applications should be removed from the cluster if you want the new repo to be the only deployment source.
- Generated output, experiments, and legacy deployment assets were intentionally removed.
