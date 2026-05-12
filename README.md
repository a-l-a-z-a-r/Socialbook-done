# Socialbook

Minimalized repository layout focused on the deployable application and monitoring stack.

## Structure

- `apps/backend` - NestJS backend source
- `apps/frontend` - React frontend source
- `deploy/backend` - one reusable backend Helm chart plus per-service values
- `deploy/frontend` - frontend Helm chart with ingress
- `deploy/prometheus` - Prometheus Helm chart
- `deploy/grafana` - Grafana Helm chart
- `deploy/argocd` - Argo CD applications wiring the charts together

## Backend Releases

The backend chart is reused for these services:

- `socialbook-reviews`
- `socialbook-users`
- `socialbook-social`
- `socialbook-notifications`
- `socialbook-booklists`

Service-specific values live in `deploy/backend/values`.

## Notes

- MongoDB is expected to run outside Kubernetes.
- Keycloak and RabbitMQ are no longer part of this repository.
- Generated output, experiments, and legacy deployment assets were intentionally removed.
