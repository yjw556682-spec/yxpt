# yxpt — deploying on Aliyun Lightweight Application Server

This guide deploys the full yxpt stack on a single Aliyun Lightweight instance
(2 vCPU / 2 GB RAM, ~60 CNY/month). One container runs the API, another runs
Postgres, the built web bundle is either served by nginx on the same host or
pushed to Cloudflare Pages (recommended).

> **Why Aliyun Lightweight and not Vercel / Cloudflare Workers?**
> The bot sandbox uses `isolated-vm`, which is a native Node addon — it needs a
> long-lived Node process with full FS access. Serverless platforms won't run
> it. A small VPS is the simplest, cheapest fit.

---

## 1. Prerequisites

| What | Why | Approx cost |
|---|---|---|
| Aliyun account | To buy the instance | — |
| Lightweight Application Server, 2 vCPU / 2 GB | Runs Docker + the api container | ~60 CNY/month |
| Hong Kong or mainland region | Mainland is fastest inside CN; HK avoids ICP for international traffic | — |
| SSH key pair | To log in | — |
| A domain you control (optional but recommended) | For HTTPS — pointing it at the server's public IP | ~50–80 CNY/year |
| Cloudflare account (free tier) | Recommended for the frontend & DNS proxy | 0 |

> Hong Kong regions do not require ICP filing. Mainland regions do (Aliyun will
> guide you through it).

---

## 2. One-time server setup

SSH into the instance (Aliyun web console → 实例 → 远程连接):

```bash
# Update the system
sudo apt update && sudo apt upgrade -y       # or yum/dnf on Aliyun Linux

# Install Docker + the Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in so the group change takes effect

docker --version
docker compose version

# Open 80/443 in the in-OS firewall
sudo bash deploy/aliyun-firewall.sh
```

Then **also** open 80/443 in the Aliyun Security Group
(console → 实例 → 防火墙). The script reminds you — the Security Group is the
outer layer, in-OS rules alone are not enough.

Point your domain's A record at the instance's public IP. (Skip if you'll use
Cloudflare Pages for the frontend — you can still proxy `/api/*` through the
domain if you want.)

---

## 3. Deploy the API + database

```bash
# On the server, as a non-root user with docker group membership:
git clone https://github.com/your-org/yxpt.git
cd yxpt

cp deploy/.env.example deploy/.env
nano deploy/.env
```

In `deploy/.env`:

- `POSTGRES_PASSWORD` — generate with `openssl rand -hex 24`.
- `ADMIN_TOKEN` — generate with `openssl rand -hex 32`.

Bring the stack up:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

This will:

1. Build the `@yxpt/server` image (compile isolated-vm natively — slow the
   first time, ~3 min).
2. Start `yxpt-db` (Postgres 16) and run `initDb` against it from the api on
   first boot.
3. Start `yxpt-api` on `127.0.0.1:3000`.

Verify:

```bash
docker compose -f deploy/docker-compose.yml ps
curl http://127.0.0.1:3000/healthz
# → { "ok": true }
```

---

## 4. Frontend — choose one

### Option A — Cloudflare Pages (recommended)

Pros: free, global CDN, automatic HTTPS, no nginx to maintain.

```bash
# On your LOCAL machine:
pnpm install
pnpm --filter @yxpt/web build
# upload packages/web/dist to Cloudflare Pages via the dashboard or
# `wrangler pages deploy packages/web/dist --project-name yxpt`
```

In Cloudflare Pages → your project → Settings → Environment variables, add:

- `VITE_API_BASE` = `https://api.your-domain.example.com/api`

Then rebuild from the dashboard (or push a commit). The web app calls
`/api/*` by default; if you set `VITE_API_BASE` to an absolute URL you must
also update `packages/web/vite.config.ts` to skip the proxy. The simplest
setup is to keep the relative `/api/*` and put Cloudflare in front of your
domain so `/api/*` reverse-proxies to the API container.

### Option B — Nginx on the same server

Build locally and copy the bundle over:

```bash
pnpm install
pnpm --filter @yxpt/web build
scp -r packages/web/dist/* your-server:/var/www/yxpt-web/
```

Then on the server:

```bash
sudo apt install -y nginx
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/yxpt
sudo ln -s /etc/nginx/sites-available/yxpt /etc/nginx/sites-enabled/yxpt
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. SSL

Two easy options:

### Option A — Cloudflare proxy (zero config)

If you use Cloudflare for DNS:

1. Add an A record `api.your-domain.com → <server IP>` (proxied = orange cloud).
2. Cloudflare issues a certificate automatically and handles HTTPS termination.
   The nginx above can then listen on plain HTTP and Cloudflare talks to it on
   `127.0.0.1:3000` (or 80) over the internal Cloudflare network.

### Option B — Caddy auto-HTTPS

`apt install caddy` then a one-liner Caddyfile (placeholder — write
`deploy/Caddyfile` if you want this officially supported):

```
api.your-domain.example.com {
    reverse_proxy 127.0.0.1:3000
}
your-domain.example.com {
    root * /var/www/yxpt-web
    file_server
    try_files {path} /index.html
}
```

Caddy obtains and renews Let's Encrypt certificates automatically. Open 80 and
443 in the Security Group.

---

## 6. Update workflow

When you push a change to `main`:

```bash
ssh your-server 'cd yxpt && git pull && pnpm install && pnpm -r build'
ssh your-server 'docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build api'
```

If you also serve the web bundle from nginx, rebuild locally and re-upload the
`dist/` directory (or rsync).

---

## 7. Cost summary

| Item | Cost |
|---|---|
| Lightweight 2C2G instance | ~60 CNY/month |
| Postgres | 0 (runs in the same container as the API, on the local docker network) |
| Frontend hosting | 0 (Cloudflare Pages free tier) |
| Domain (optional) | ~50–80 CNY/year |
| SSL | 0 (Cloudflare or Caddy/Let's Encrypt) |
| **Total** | **~60–70 CNY/month + domain** |

For the first year of a student project you can stay under ~10 CNY/month by
turning the instance off when not in use.

---

## 8. Backups

Postgres data lives in the named volume `yxpt-pgdata`. To back up:

```bash
# Logical dump (small, version-independent)
docker compose -f deploy/docker-compose.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > yxpt-$(date +%F).sql.gz

# Restore
gunzip -c yxpt-2026-06-20.sql.gz | \
  docker compose -f deploy/docker-compose.yml exec -T db \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Schedule with cron (every 6h):

```cron
0 */6 * * * cd /home/yxpt/yxpt && /usr/local/bin/docker compose -f deploy/docker-compose.yml exec -T db pg_dump -U yxpt -d yxpt | gzip > /home/yxpt/backups/yxpt-$(date +\%F-\%H\%M).sql.gz
```

Also consider off-host copies (Aliyun OSS, S3, rsync to another machine) —
local disk loss = total loss.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `curl /healthz` times out | API container not running | `docker compose logs api` |
| API container restarts every few seconds | Postgres not ready or wrong `DATABASE_URL` | Check `docker compose logs db` |
| `isolated-vm` build fails | Missing build deps | Make sure `apk add python3 make g++` ran in the deps stage |
| 502 from Cloudflare → api | Origin not reachable from internet on 443 | Verify Security Group allows 443 |
| `error: no space left on device` | Logs filling the volume | `docker system prune -af --volumes` |
| Bot always loses with `runtime` | Bot's `while(true)` exceeds 50 ms | Bug in your strategy, not the platform |

---

## 10. What runs where (TL;DR)

```
                ┌──────────────────────────────────────────────┐
                │ Aliyun Lightweight 2C2G (~60 CNY/month)     │
                │                                              │
   Internet ──▶ │  Cloudflare (DNS + CDN + HTTPS)              │
                │     │                                        │
                │     ▼                                        │
                │  nginx (only if you don't use CF Pages)      │
                │     │                                        │
                │     ├─▶ /var/www/yxpt-web  (static SPA)      │
                │     │                                        │
                │     └─▶ /api/* ──▶ 127.0.0.1:3000 (api)      │
                │                      │                       │
                │                      ▼                       │
                │              yxpt-api container              │
                │              (Fastify + isolated-vm)         │
                │                      │                       │
                │                      ▼                       │
                │              yxpt-db  container               │
                │              (Postgres 16, no host port)     │
                │                                              │
                └──────────────────────────────────────────────┘
```