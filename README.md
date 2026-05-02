# Socialbook

[![Coverage](https://codecov.io/gh/a-l-a-z-a-r/Socialbook/branch/Dev/graph/badge.svg)](https://codecov.io/gh/a-l-a-z-a-r/Socialbook)
[![Tests](https://github.com/a-l-a-z-a-r/Socialbook/actions/workflows/ci.yml/badge.svg?branch=Dev)](https://github.com/a-l-a-z-a-r/Socialbook/actions/workflows/ci.yml)

Spotify but for books; ENJOY!!

## Microservices and Helm Charts

The backend is deployed as dedicated microservices (reviews, users, social, notifications, booklists) and the notifications worker. Each API service has its own MongoDB deployment, and cross-service calls go through Kubernetes services rather than in-process Nest imports. See `helm/README.md` for chart locations and install order.

The application deployment source of truth is Helm. Legacy raw Kubernetes manifests for the Socialbook app stack have been removed; keep application deployment changes in `helm/` and `helm/overrides/`.

Argo CD Application manifests for the microservices live at `k8s/argocd/socialbook-apps.yaml`.

## Shared Schemas

JSON Schema contracts for shared event and internal API payloads live in `schemas/`.
These currently cover:

- `schemas/events/review-created.schema.json`
- `schemas/events/review-commented.schema.json`
- `schemas/events/booklist-updated.schema.json`
- `schemas/events/import-requested.schema.json`
- `schemas/api/create-notification-request.schema.json`

The reviews service validates event payloads before publishing, and the workers plus notifications API validate them again on consume/request boundaries.

## Viewing Coverage Reports

Generate HTML coverage report:
```
pytest --cov=examples --cov-report=html
```

Open in browser:
```
open htmlcov/index.html
```
