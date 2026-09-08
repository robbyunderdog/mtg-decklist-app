# Deploying to your own hardware

This deploys the app on a Linux box you own, exposed at your own domain via a **Cloudflare
Tunnel** — no port forwarding, no exposed home IP, works even if your ISP gives you a dynamic
IP or sits you behind CGNAT. The database stays on Neon (the hosted Postgres you already use
for local dev), so there's nothing to back up or maintain on the box itself.

Architecture: `Browser → Cloudflare's edge (TLS) → cloudflared (on your box) → Express (API + built client, one process) → Neon`

## Prerequisites

- A Linux machine (any recent distro) that's on and connected to the internet whenever you
  want the app reachable.
- [Docker Engine + the Compose plugin](https://docs.docker.com/engine/install/) installed on it.
- Your domain's nameservers pointed at Cloudflare (free plan is fine). If it's not already:
  in the Cloudflare dashboard, **Add a site**, pick the free plan, and update your domain
  registrar's nameservers to the two Cloudflare gives you. This can take a few minutes to a
  few hours to propagate.

## 1. Create the tunnel

In the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel**.

1. Choose **Cloudflared** as the connector type, give it a name (e.g. `mtg-decklist`).
2. It'll show you a `docker run` command containing a long token — you only need the token
   itself (the part after `--token`). Copy it.
3. Under **Public Hostname**, add one:
   - **Subdomain/Domain**: whatever you want the app to live at (e.g. `decks.yourdomain.com`,
     or your bare domain).
   - **Service**: `HTTP` → `app:4000` — that's the Docker Compose service name and port from
     `docker-compose.yml`, not `localhost`, since cloudflared and the app talk to each other
     over the Docker network, not your host's network.
4. Save. Cloudflare handles the TLS certificate for that hostname automatically — nothing to
   configure for HTTPS on your end.

## 2. Configure and start the app

On the box, clone the repo, then:

```bash
cp .env.production.example .env
# edit .env: DATABASE_URL, JWT_SECRET, CLIENT_ORIGIN (your real domain), and
# CLOUDFLARE_TUNNEL_TOKEN (the token from step 1)

docker compose up -d --build
```

That builds the client, builds the server, and starts both the app and the tunnel daemon.
Give it a minute, then visit the hostname you configured in step 1 — you should see the login
page over HTTPS.

## Redeploying after a code change

```bash
git pull
docker compose up -d --build
```

Compose rebuilds only what changed and restarts the `app` container; `cloudflared` keeps
running throughout, so there's no gap in the tunnel itself (just a brief moment where `app`
is restarting and requests would fail until it's back up).

## Checking on it

```bash
docker compose logs -f app          # server logs
docker compose logs -f cloudflared  # tunnel connection status
docker compose ps                   # both should show "Up"
```

`restart: unless-stopped` in the compose file means both containers come back automatically
if the box reboots or Docker restarts — as long as Docker itself is set to start on boot,
which its installer does by default on most distros (`systemctl is-enabled docker` to check).

## Notes

- **No inbound firewall rules needed.** cloudflared makes an *outbound* connection to
  Cloudflare; nothing needs to be listening on a public port on your box at all. You can
  leave your router's firewall exactly as it is.
- **Rotating the tunnel token** or adding a second hostname (e.g. if you later split staging
  and prod) is done entirely from the Cloudflare dashboard — no docker-compose or app changes
  needed.
- **This setup does not include database backups** — Neon handles that. If you later move the
  database onto this same box, you'd need to add that yourself.
