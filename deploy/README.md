# Blackheart frontend — production deployment

Reference for running the Next.js 14 frontend on the VPS (Ubuntu 22.04,
host `Middleware`, IP `202.74.75.3`).

## Layout

```
deploy/
├── README.md
├── systemd/
│   └── blackheart-frontend.service     # next start under systemd
└── scripts/
    ├── install-vps.sh                  # one-time host bootstrap
    └── frontend.env.example            # optional runtime env (most config is build-time)
```

## Topology

```
Internet
   │
   ▼
Cloudflare Tunnel (cloudflared on VPS, already running)
   │  http://127.0.0.1:3000
   ▼
next start (systemd: blackheart-frontend)   ← THIS REPO
```

No nginx in front. No public port exposure on the VPS itself. Cloudflared
terminates TLS and proxies to the loopback `next start` process.

## One-time host setup

From the VPS, as `starsky`:

```bash
# Pull the repo (or rsync deploy/ from the runner)
cd /tmp && git clone <repo-url> blackridge-frontend && cd blackridge-frontend

# Run the bootstrap
bash deploy/scripts/install-vps.sh
```

The script: verifies Node 20+, enables corepack/pnpm 9, creates the
`blackheart-frontend` system user, prepares `/opt/blackheart-frontend/`,
installs the systemd unit, and reminds you to add a cloudflared ingress
rule (one manual step, see below).

### Cloudflared ingress (manual)

Edit `/etc/cloudflared/config.yml` (or the equivalent in the dashboard):

```yaml
ingress:
  - hostname: app.yourdomain.example
    service: http://127.0.0.1:3000
  # ... existing entries (e.g. gateway on :8088) ...
  - service: http_status:404
```

Then `sudo systemctl restart cloudflared` and verify DNS resolution.

## CI/CD

The deploy job in `.github/workflows/ci.yml` runs on every push to `master`
when the repo variable `DEPLOY_ENABLED=true`. Required secrets:

| Secret | Value |
|---|---|
| `VPS_HOST` | `202.74.75.3` |
| `VPS_USER` | `starsky` |
| `VPS_SSH_KEY` | full contents of `sshkey.pem` (including `-----BEGIN` and trailing newline) |

Required repo variables (NEXT_PUBLIC_* are baked into the build — see
`next.config.mjs:13-30` for the strict-prod check):

| Variable | Example | Required? |
|---|---|---|
| `DEPLOY_ENABLED` | `true` | yes — gates the deploy job |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.example` | **yes — prod build throws without it** |
| `NEXT_PUBLIC_WS_URL` | `wss://api.yourdomain.example/ws` | **yes — prod build throws without it** |
| `NEXT_PUBLIC_RESEARCH_URL` | (omit for single-JVM) | no |

## What the deploy job does

1. Builds the artifact on the runner (`pnpm install --frozen-lockfile && pnpm build`).
2. Tars up `.next/`, `public/`, `package.json`, `pnpm-lock.yaml`, `next.config.mjs`.
3. scps the tar to `/opt/blackheart-frontend/releases/<sha>/`.
4. Over SSH: `pnpm install --prod --frozen-lockfile` on the host.
5. Captures the previous symlink target for rollback.
6. `sudo systemctl stop blackheart-frontend`.
7. `sudo ln -sfn /opt/blackheart-frontend/releases/<sha> /opt/blackheart-frontend/current`.
8. `sudo systemctl start blackheart-frontend`.
9. Health probe: `curl -fsS http://127.0.0.1:3000/` (up to 60s wait).
10. On failure: swap the symlink back to the previous release and start.

## Manual upgrade (skipping CI)

```bash
# Assume new release at /opt/blackheart-frontend/releases/<new-sha>/ with deps installed
sudo systemctl stop blackheart-frontend
sudo ln -sfn /opt/blackheart-frontend/releases/<new-sha> /opt/blackheart-frontend/current
sudo systemctl start blackheart-frontend
curl -fsS http://127.0.0.1:3000/    # healthcheck
```

Rollback is the same command with a different sha — `readlink /opt/blackheart-frontend/current`
shows what's active right now.

**Do not** `systemctl restart` for code upgrades — that kills the old process
before validating the new one. Stop, swap, start so you can fall back.

## Health monitoring

```bash
# Up?
systemctl is-active blackheart-frontend

# Logs
journalctl -u blackheart-frontend -f

# Memory pressure
systemctl status blackheart-frontend | grep -E 'Memory|Tasks'

# What release is live?
readlink /opt/blackheart-frontend/current
```

## Resource budget

| Service | NODE_OPTIONS heap | MemoryMax | CPUQuota |
|---|---|---|---|
| `blackheart-frontend` | 512 MB | 768 MB | 80% (~0.8 cores) |

On the 2 GB / 2-core host that leaves ~1 GB and 1.2 cores for cloudflared,
the gateway, and OS overhead. Tight but workable.

## What is NOT covered here

- Trading JVM and exchange-gateway have their own deploy/ directories with
  their own systemd units (see `blackheart-trading-engine/deploy/` and
  `blackheart-exchange-gateway/deploy/`).
- The trading JVM does NOT fit on this VPS as currently sized (needs 3 GB+;
  host has 1.9 GB). Trading stays local until hardware changes.
- Postgres, Redis, Kafka — all remain on local infra; the frontend only
  needs them indirectly via API calls to the trading JVM.
