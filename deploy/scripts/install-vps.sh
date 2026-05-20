#!/usr/bin/env bash
# One-time VPS bootstrap for the Blackheart frontend.
#
# Target: Ubuntu 22.04 (host: Middleware, user: starsky with NOPASSWD sudo).
# Run from the gh runner OR manually as `starsky` over SSH:
#   bash deploy/scripts/install-vps.sh
#
# Idempotent — re-running is safe. Does NOT deploy code; only prepares the
# host so a subsequent `ci.yml` deploy job can swap a release into place.

set -euo pipefail

APP_USER=blackheart-frontend
APP_ROOT=/opt/blackheart-frontend
ENV_FILE=/etc/blackheart/frontend.env

step() { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }

step "Verify Node 20+"
if ! command -v node >/dev/null 2>&1; then
  echo "node is missing — install Node 20.x first (nodesource setup or your preferred channel)" >&2
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "node $NODE_MAJOR found; this app needs Node >= 20" >&2
  exit 1
fi
node --version

step "Enable corepack + pnpm 9"
sudo corepack enable
sudo corepack prepare pnpm@9 --activate
pnpm --version

step "Create least-privilege service user (no shell, no home)"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  sudo useradd --system --shell /usr/sbin/nologin --home-dir "$APP_ROOT" --no-create-home "$APP_USER"
fi
id "$APP_USER"

step "Create release/log directories"
sudo mkdir -p "$APP_ROOT/releases" "$APP_ROOT/logs"
sudo chown -R "$APP_USER:$APP_USER" "$APP_ROOT"
sudo chmod 755 "$APP_ROOT"

step "Stage env file (optional — most config is build-time)"
sudo mkdir -p /etc/blackheart
if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$(dirname "$0")/frontend.env.example" ]; then
    sudo install -m 600 -o root -g root "$(dirname "$0")/frontend.env.example" "$ENV_FILE"
    echo "Installed empty $ENV_FILE from example. Edit if needed."
  else
    sudo install -m 600 -o root -g root /dev/null "$ENV_FILE"
  fi
else
  echo "$ENV_FILE already exists — leaving alone."
fi

step "Install systemd unit"
UNIT_SRC="$(dirname "$0")/../systemd/blackheart-frontend.service"
if [ -f "$UNIT_SRC" ]; then
  sudo install -m 644 -o root -g root "$UNIT_SRC" /etc/systemd/system/blackheart-frontend.service
  sudo systemctl daemon-reload
  sudo systemctl enable blackheart-frontend
  echo "systemd unit installed + enabled. Service will start once a release is deployed."
else
  echo "WARN: systemd unit not found at $UNIT_SRC — install manually." >&2
fi

step "Cloudflare tunnel reminder"
cat <<EOF
The frontend binds to 127.0.0.1:3000 — not exposed publicly by the VPS.
To route inbound traffic, add an ingress entry to your existing cloudflared
config (likely at /etc/cloudflared/config.yml or in the dashboard):

  ingress:
    - hostname: app.yourdomain.example
      service: http://127.0.0.1:3000
    # ... existing entries ...

Then: sudo systemctl restart cloudflared

This step is NOT automated here — it depends on your CF account + DNS setup.
EOF

step "Done"
echo "Next: push to master, the gh workflow will scp a release into $APP_ROOT/releases/ and swap the symlink."
