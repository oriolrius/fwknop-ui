# Deploying fwknop-ui (y0 / k.joor.net)

Production deployment: Docker Compose stack on **y0** (`10.2.0.3`), reverse-proxied by
NPM (`10.2.0.2`) and reachable at **https://k.joor.net**. Auth is Keycloak OIDC
(realm `fwknop` at `iam.joor.net`).

## Images (CI/CD)

`.github/workflows/docker-publish.yml` builds and pushes to **GHCR** on every push:

| Trigger | Tags |
|---|---|
| push to `main` | `:latest`, `:main-<sha>` |
| tag `vX.Y.Z` | `:X.Y.Z`, `:X.Y`, `:latest` |
| pull request | build only (no push) |

Image: `ghcr.io/oriolrius/fwknop-ui`. Make the GHCR package **public** so y0 can pull
anonymously (Packages → fwknop-ui → Package settings → Change visibility).

## Host layout (y0)

```
/opt/stacks/fwknop-ui/
├── docker-compose.yaml   # from deploy/docker-compose.yaml
├── config.yaml           # from deploy/config.example.yaml (git-ignored)
├── .env                  # secrets, chmod 600 (git-ignored)
├── fwknoprc              # ~/.fwknoprc SPA stanzas, mounted read-only (optional)
└── volume fwknop-data    # presets + history
```

## First deploy

```bash
ssh root@10.2.0.3
mkdir -p /opt/stacks/fwknop-ui && cd /opt/stacks/fwknop-ui
# copy docker-compose.yaml, config.yaml, .env, fwknoprc here

# Until CI has published the image, build it locally:
git clone -b main https://github.com/oriolrius/fwknop-ui /opt/src/fwknop-ui
docker build -t ghcr.io/oriolrius/fwknop-ui:latest /opt/src/fwknop-ui

docker compose up -d
docker compose logs -f          # expect "listening on :8787"
curl -si localhost:8787/api/meta   # 401 = auth on and working
```

## Updates (after CI is live)

```bash
cd /opt/stacks/fwknop-ui
docker compose pull && docker compose up -d
```

## Secrets

- `AUTH_CLIENT_SECRET` — Keycloak client secret, Bitwarden *"fwknop-ui OIDC client (Keycloak fwknop realm)"*.
- `AUTH_SESSION_SECRET` — `openssl rand -hex 32`.

Never commit `config.yaml`, `.env`, or `fwknoprc` (see `.gitignore`).
