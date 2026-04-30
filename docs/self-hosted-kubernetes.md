# Self-Hosted Kubernetes Setup For Socialbook

This repo already contains most of the Kubernetes pieces needed to run Socialbook outside the LTU cluster. The missing part is replacing the LTU-specific infrastructure and hostnames with your own.

## What Socialbook Actually Needs

From the codebase and Helm values, the deployed system is:

- `socialbook-frontend`
- `socialbook-reviews`
- `socialbook-users`
- `socialbook-social`
- `socialbook-notifications`
- `socialbook-booklists`
- `socialbook-notifications-worker`
- one MongoDB instance per backend service
- RabbitMQ
- Keycloak
- an ingress controller
- cert-manager

Code references:

- Frontend Keycloak config: [frontend/src/keycloak-config.js](/home/alazar/Socialbook/frontend/src/keycloak-config.js:1)
- Backend Keycloak token validation: [backend/src/auth/keycloak.guard.ts](/home/alazar/Socialbook/backend/src/auth/keycloak.guard.ts:20)
- Users service Keycloak admin client usage: [backend/src/auth/keycloak-admin.service.ts](/home/alazar/Socialbook/backend/src/auth/keycloak-admin.service.ts:31)
- RabbitMQ dependency in backend services: [backend/src/queue/queue.service.ts](/home/alazar/Socialbook/backend/src/queue/queue.service.ts:62)
- Notifications worker dependency: [worker/worker.js](/home/alazar/Socialbook/worker/worker.js:4)

## Hetzner-Specific Notes

For a single-node Hetzner deployment, the simplest working path is:

- one `CX33`
- `Ubuntu 24.04`
- `k3s`
- Traefik ingress (already bundled with `k3s`)
- Let's Encrypt via `cert-manager`

If you do not have a custom domain yet, you can use `nip.io` temporarily. Example for a server IP `203.0.113.10`:

- `socialbook.203-0-113-10.nip.io`
- `keycloak.203-0-113-10.nip.io`

Then replace the self-hosted Helm overrides with those hostnames before deploying.

## What Must Change From The LTU Cluster

These values are hardcoded for the old course environment and must be replaced in your own deployment:

- `https://keycloak.ltu-m7011e-11.se`
- `socialbook.ltu-m7011e-11.se`
- `amqp://admin:HelloWorld123@rabbitmq-service-api.rabbitmq.svc.cluster.local:5672`

Relevant files:

- [helm/socialbook-frontend/values.yaml](/home/alazar/Socialbook/helm/socialbook-frontend/values.yaml:13)
- [helm/socialbook-reviews/values.yaml](/home/alazar/Socialbook/helm/socialbook-reviews/values.yaml:14)
- [helm/socialbook-users/values.yaml](/home/alazar/Socialbook/helm/socialbook-users/values.yaml:14)
- [helm/socialbook-social/values.yaml](/home/alazar/Socialbook/helm/socialbook-social/values.yaml:14)
- [helm/socialbook-notifications/values.yaml](/home/alazar/Socialbook/helm/socialbook-notifications/values.yaml:14)
- [helm/socialbook-booklists/values.yaml](/home/alazar/Socialbook/helm/socialbook-booklists/values.yaml:14)
- [helm/socialbook-notifications-worker/values.yaml](/home/alazar/Socialbook/helm/socialbook-notifications-worker/values.yaml:14)
- [helm/socialbook-ingress/values.yaml](/home/alazar/Socialbook/helm/socialbook-ingress/values.yaml:1)
- [keycloak/keycloak-chart/values.yaml](/home/alazar/Socialbook/keycloak/keycloak-chart/values.yaml:1)

There is also a RabbitMQ credential mismatch in the repo:

- the RabbitMQ chart defaults to user `alazar111`: [RabbitMQ/values.yaml](/home/alazar/Socialbook/RabbitMQ/values.yaml:1)
- the applications default to user `admin`

For your own cluster, use one consistent username/password everywhere.

## Recommended Architecture

Use a small cloud VM and run `k3s` unless your course requires something else.

- 2 vCPU minimum
- 4 GB RAM minimum
- 40 GB disk minimum
- public IPv4 address
- one domain or subdomain you control

Example hostnames:

- `socialbook.example.com`
- `keycloak.example.com`

Recommended namespaces:

- `socialbook`
- `keycloak`
- `cert-manager`
- `ingress-nginx` or `traefik`

This repo uses Traefik in the included ingress manifests, which fits well with `k3s`.

## Minimal Build And Deploy Plan

### 1. Create a server and install k3s

On your VM:

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
```

Copy kubeconfig to your machine if you want to operate remotely:

```bash
sudo cat /etc/rancher/k3s/k3s.yaml
```

### 2. Point DNS to the VM

Create DNS records:

- `socialbook.example.com` -> your VM public IP
- `keycloak.example.com` -> your VM public IP

### 3. Install cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.18.2/cert-manager.yaml
kubectl get pods -n cert-manager
```

Create a ClusterIssuer:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: your-email@example.com
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
```

Apply it:

```bash
kubectl apply -f cluster-issuer.yaml
```

### 4. Deploy Keycloak first

The application depends on Keycloak both for browser login and backend JWT validation.

Use:

- [keycloak/keycloak-chart/values.yaml](/home/alazar/Socialbook/keycloak/keycloak-chart/values.yaml:1)
- [helm/overrides/self-hosted/keycloak-values.yaml](/home/alazar/Socialbook/helm/overrides/self-hosted/keycloak-values.yaml:1)

If you are using Hetzner without your own domain yet, replace:

- `keycloak.example.com` with `keycloak.<your-server-ip-with-dashes>.nip.io`
- `socialbook.example.com` with `socialbook.<your-server-ip-with-dashes>.nip.io`

Install:

```bash
kubectl create namespace keycloak
helm upgrade --install keycloak ./keycloak/keycloak-chart \
  -n keycloak \
  -f ./helm/overrides/self-hosted/keycloak-values.yaml
```

Wait until Keycloak is reachable at `https://keycloak.example.com`.

### 5. Configure Keycloak manually

Create the realm and clients before starting Socialbook:

- Realm: `Userenter`
- Public client: `socialbook`
- Confidential client: `socialbook-admin`

For `socialbook`:

- Client type: public
- Valid redirect URIs:
  - `https://socialbook.example.com/*`
- Web origins:
  - `https://socialbook.example.com`

For `socialbook-admin`:

- Client type: confidential
- Service accounts enabled: on
- Save the generated client secret

The users service expects these env vars:

- `KEYCLOAK_ADMIN_CLIENT_ID`
- `KEYCLOAK_ADMIN_CLIENT_SECRET`
- `KEYCLOAK_PUBLIC_CLIENT_ID`

See [helm/socialbook-users/values.yaml](/home/alazar/Socialbook/helm/socialbook-users/values.yaml:14).

### 6. Deploy RabbitMQ

Install RabbitMQ into the same namespace as the Socialbook services to simplify service DNS:

```bash
kubectl create namespace socialbook
helm upgrade --install rabbitmq ./RabbitMQ \
  -n socialbook \
  -f ./helm/overrides/self-hosted/rabbitmq-values.yaml
```

Use one consistent URL in all Socialbook services, for example:

```text
amqp://socialbook:CHANGE_ME@rabbitmq-service-api:5672
```

### 7. Deploy the Socialbook charts

Install MongoDB charts first:

```bash
helm upgrade --install socialbook-mongo-reviews ./helm/socialbook-mongo-reviews -n socialbook
helm upgrade --install socialbook-mongo-users ./helm/socialbook-mongo-users -n socialbook
helm upgrade --install socialbook-mongo-social ./helm/socialbook-mongo-social -n socialbook
helm upgrade --install socialbook-mongo-booklists ./helm/socialbook-mongo-booklists -n socialbook
helm upgrade --install socialbook-mongo-notifications ./helm/socialbook-mongo-notifications -n socialbook
```

Then the application services:

```bash
helm upgrade --install socialbook-reviews ./helm/socialbook-reviews -n socialbook -f ./helm/overrides/self-hosted/reviews-values.yaml
helm upgrade --install socialbook-users ./helm/socialbook-users -n socialbook -f ./helm/overrides/self-hosted/users-values.yaml
helm upgrade --install socialbook-social ./helm/socialbook-social -n socialbook -f ./helm/overrides/self-hosted/social-values.yaml
helm upgrade --install socialbook-notifications ./helm/socialbook-notifications -n socialbook -f ./helm/overrides/self-hosted/notifications-values.yaml
helm upgrade --install socialbook-booklists ./helm/socialbook-booklists -n socialbook -f ./helm/overrides/self-hosted/booklists-values.yaml
helm upgrade --install socialbook-frontend ./helm/socialbook-frontend -n socialbook -f ./helm/overrides/self-hosted/frontend-values.yaml
helm upgrade --install socialbook-notifications-worker ./helm/socialbook-notifications-worker -n socialbook -f ./helm/overrides/self-hosted/notifications-worker-values.yaml
helm upgrade --install socialbook-ingress ./helm/socialbook-ingress -n socialbook -f ./helm/overrides/self-hosted/ingress-values.yaml
```

## Required Image Strategy

Your charts currently expect these images:

- `alazar111/socialbook-backend`
- `alazar111/socialbook-frontend`
- `alazar111/socialbook-notifications-worker`

If those images are no longer being built automatically, you need to build and push them yourself before deploying.

Example:

```bash
docker build -t yourdockerhub/socialbook-backend:latest ./backend
docker build -t yourdockerhub/socialbook-frontend:latest ./frontend
docker build -t yourdockerhub/socialbook-notifications-worker:latest ./worker

docker push yourdockerhub/socialbook-backend:latest
docker push yourdockerhub/socialbook-frontend:latest
docker push yourdockerhub/socialbook-notifications-worker:latest
```

Then replace the image repositories in the override files.

## Verification Checklist

### Infrastructure

```bash
kubectl get pods -A
kubectl get ingress -A
kubectl get certificate -A
```

### Socialbook services

```bash
kubectl get pods -n socialbook
kubectl get svc -n socialbook
kubectl logs -n socialbook deploy/socialbook-users
kubectl logs -n socialbook deploy/socialbook-frontend
kubectl logs -n socialbook deploy/socialbook-notifications-worker
```

### Functional checks

Open:

- `https://socialbook.example.com`
- `https://socialbook.example.com/api/docs/reviews`
- `https://socialbook.example.com/api/docs/users`
- `https://keycloak.example.com`

Test:

1. Sign up a user
2. Log in through Keycloak
3. Load the feed
4. Create a review
5. Add a comment
6. Confirm notifications worker receives events

## Likely Failure Points

### Login fails or frontend shows missing auth config

Check frontend env values:

- `VITE_KEYCLOAK_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`

See [frontend/src/App.jsx](/home/alazar/Socialbook/frontend/src/App.jsx:292).

### Backend returns unauthorized for valid tokens

Check:

- realm name matches exactly
- frontend client ID matches backend audience expectations
- backend `KEYCLOAK_URL` is the public issuer URL

See [backend/src/auth/keycloak.guard.ts](/home/alazar/Socialbook/backend/src/auth/keycloak.guard.ts:25).

### User signup/login API fails

Check the users service confidential client and secret:

- `KEYCLOAK_ADMIN_CLIENT_ID`
- `KEYCLOAK_ADMIN_CLIENT_SECRET`

See [backend/src/auth/keycloak-admin.service.ts](/home/alazar/Socialbook/backend/src/auth/keycloak-admin.service.ts:33).

### Notifications do not appear

Check both:

- backend services can connect to RabbitMQ
- worker can connect to RabbitMQ and call `http://socialbook-notifications:5000/internal/notifications`

See:

- [backend/src/queue/queue.service.ts](/home/alazar/Socialbook/backend/src/queue/queue.service.ts:62)
- [worker/worker.js](/home/alazar/Socialbook/worker/worker.js:13)

### TLS never becomes ready

Check:

- DNS points to the correct public IP
- ingress class in your ClusterIssuer matches the controller you installed
- port 80 and 443 are open on the VM

## What I Would Change Next

If you want this to be easier to operate long-term, the next cleanup should be:

1. move sensitive values out of Helm `values.yaml` and into Kubernetes `Secret`s
2. add persistent volumes for MongoDB and PostgreSQL instead of `emptyDir`
3. add readiness probes to the Socialbook services
4. fix the RabbitMQ username mismatch in the default repo values
5. create one bootstrap script for Keycloak realm and clients

Without those improvements, the project can still run, but it is more fragile than it needs to be.
