# Deploying to your own hardware

This deploys the app on a Linux box you own (written for Debian; any distro with Docker works),
exposed at your own domain via a **Cloudflare Tunnel** — no port forwarding, no exposed home
IP, works even behind CGNAT or a dynamic IP. The database stays on Neon, so there's nothing to
back up or maintain on the box itself.

```
Browser → Cloudflare edge (HTTPS) → cloudflared container → app container (Express: API + client) → Neon
```

cloudflared runs as a container from `docker-compose.yml` — you do **not** install it on the
host.

## Prerequisites

- A Linux machine/VM that's on whenever you want the app reachable. 2 GB RAM or more (or add
  swap — see Troubleshooting) so the client build doesn't run out of memory.
- A domain using Cloudflare's nameservers. If it isn't yet: Cloudflare dashboard → **Add a
  site** → Free plan → change your registrar's nameservers to the two Cloudflare gives you,
  and wait until the site shows **Active** (minutes to a few hours).
- Your Neon `DATABASE_URL`.

## 1. Install Docker (Debian)

Skip if `docker compose version` already works.

```bash
sudo apt update
sudo apt install -y ca-certificates curl git openssl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker   # start on boot
sudo usermod -aG docker $USER        # run docker without sudo — log out and back in after
```

## 2. Clone the repo

The repo is private, so cloning needs a GitHub **personal access token** in place of a
password: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained →
Generate new token, scoped to this repository with **Contents: Read-only**.

```bash
cd ~
git clone https://github.com/robbyunderdog/mtg-decklist-app.git
cd mtg-decklist-app
git config credential.helper store   # remember the token for future `git pull`s
```

When prompted for a password, paste the token.

## 3. Create the tunnel and get its token

Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** (newer
dashboards: **Networks → Connectors → Cloudflare Tunnels**).

1. Connector type **Cloudflared**, name it (e.g. `mtg-decklist`).
2. On the "Install connector" screen, pick the **Docker** tab and copy **only the token** —
   the long string after `--token`. Don't run the command it shows; Compose runs cloudflared.
3. **Leave this tab open.** The wizard won't let you continue until a connector actually
   connects, which happens in step 5.

## 4. Configure

```bash
cp .env.example .env
openssl rand -base64 48   # use the output as JWT_SECRET
nano .env
chmod 600 .env
```

Fill in `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` (the exact public URL you'll use, e.g.
`https://decks.yourdomain.com`), `SCRYFALL_CONTACT_EMAIL`, and `CLOUDFLARE_TUNNEL_TOKEN`.
Each variable is explained in `.env.example`.

### New database? Run migrations first

If `DATABASE_URL` points at the same Neon database you develop against, it's already migrated
— skip this. For a fresh database, migrations must be applied once, since the production
image doesn't include drizzle-kit and the app doesn't migrate on startup:

```bash
docker run --rm -v "$PWD/server":/app -w /app --env-file .env node:20-alpine \
  sh -c "npm ci && npx drizzle-kit migrate"
sudo rm -rf server/node_modules   # clean up what that container installed
```

(Or from your dev machine: point `server/.env`'s `DATABASE_URL` at the new database and run
`npm run db:migrate`.)

## 5. Start it

```bash
docker compose up -d --build
docker compose logs -f cloudflared   # wait for "Registered tunnel connection", then Ctrl+C
```

The first build takes a few minutes.

## 6. Add the public hostname

Back in the Cloudflare tab, the connector should now show **Connected** — click **Next**.
Under **Public Hostname** (newer UI: **Published application routes**), add:

- **Subdomain / Domain**: e.g. `decks` + `yourdomain.com` — must match `CLIENT_ORIGIN`
- **Service**: `HTTP` → `app:4000`

Use `app:4000`, **not** `localhost` — cloudflared reaches the app over the Docker network by
its Compose service name. Save; Cloudflare creates the DNS record and HTTPS certificate
automatically, and the tunnel picks up the change without a restart.

## 7. Verify

```bash
docker compose ps                                              # both services "running"
docker compose exec app wget -qO- http://localhost:4000/api/health   # {"status":"ok",...}
```

The tunnel should show **HEALTHY** in the dashboard. Visit your hostname — you should get the
login page over HTTPS.

## Redeploying after a code change

```bash
git pull
docker compose up -d --build
```

Only the `app` container is rebuilt and restarted; `cloudflared` keeps running, so there's
just a few seconds where requests fail while `app` restarts. If the change added a migration
(new files in `server/src/db/migrations/`), apply it as in step 4 before or right after.

## Day-to-day

| Task | Command |
|---|---|
| Server logs | `docker compose logs -f app` |
| Tunnel logs | `docker compose logs -f cloudflared` |
| Status | `docker compose ps` |
| Restart / stop | `docker compose restart` / `docker compose down` |
| Update cloudflared | `docker compose pull cloudflared && docker compose up -d` |
| Reclaim disk from old builds | `docker image prune -f` |

Both services use `restart: unless-stopped`, so with Docker enabled on boot (step 1) the app
comes back on its own after a reboot.

## Troubleshooting

- **`app` keeps restarting** — `docker compose logs app`. Usually a missing/invalid
  `DATABASE_URL` or a `JWT_SECRET` under 16 characters; the error names the variable.
- **Cloudflare error 502 / 1033** — the tunnel is up but can't reach the app. Check the
  hostname's service is `http://app:4000` and that `app` is running.
- **cloudflared says the token is invalid** — `CLOUDFLARE_TUNNEL_TOKEN` must be just the
  token (no `--token`, no quotes). Fix it, then `docker compose up -d`.
- **Tunnel wizard stuck waiting for a connector** — it only advances once cloudflared is
  running with the token; do steps 4–5, then go back to it.
- **Login works but you're immediately logged out, or can't log in at all** — `CLIENT_ORIGIN`
  must exactly match the URL in your browser. Also, in production the auth cookie is
  HTTPS-only, so logging in only works through the Cloudflare hostname, not `http://<vm-ip>`.
- **Domain doesn't resolve** — the domain's nameservers aren't on Cloudflare yet; check the
  site shows **Active**.
- **Build killed / out of memory** — add swap:
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```
- **Ran Cloudflare's `docker run ... --token` command by mistake** — that's a second,
  unmanaged cloudflared. Find it with `docker ps` and remove it with `docker rm -f <id>`.

## Notes

- **No inbound firewall rules needed.** cloudflared only makes outbound connections.
- **Rotating the tunnel token** or adding hostnames is done in the Cloudflare dashboard; for a
  new token, update `.env` and run `docker compose up -d`.
- **No database backups here** — Neon handles that. If you ever move Postgres onto this box,
  you'd need to add backups yourself.
