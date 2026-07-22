# Deploying to AWS (single EC2 box)

One small EC2 instance runs everything: the Next.js web server, the background
worker, and Redis. MongoDB Atlas, iDrive e2, AWS S3 (Mumbai), and Clerk stay as
external services.

## 0. Before you start — gather these
- **A domain name** (e.g. reelpouches.com) you can edit DNS for.
- **Clerk production keys** (`pk_live_…` / `sk_live_…`) — create a Production
  instance in the Clerk dashboard for your domain (it will ask you to add a few
  DNS records).
- Your existing secrets (MongoDB URI, iDrive keys, AWS keys).

## 1. Launch the EC2 instance
- EC2 → Launch instance. **Ubuntu 24.04 LTS**, type **t3.small** (2 GB RAM) to
  start. Region: **ap-south-1 (Mumbai)** (same as the archive bucket).
- Create/download a key pair (for SSH).
- Security group inbound rules: **22 (SSH)**, **80 (HTTP)**, **443 (HTTPS)**.
- Give it ~20 GB disk.
- Note the instance's **public IP**.

## 2. Point your domain at it
- In your DNS provider, add an **A record**: `your-domain.com → <public IP>`.
- (Wait a few minutes for it to propagate.)

## 3. SSH in and install the runtime
```bash
ssh -i your-key.pem ubuntu@<public IP>

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Redis (local queue)
sudo apt-get install -y redis-server
sudo systemctl enable --now redis-server

# Caddy (auto-HTTPS reverse proxy)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

# pm2 (keeps web + worker alive)
sudo npm install -g pm2
```

## 4. Get the code + secrets
```bash
git clone https://github.com/Ajaykumarz22/digital-album-storage-main.git app
cd app
cp .env.example .env.local
nano .env.local      # paste real values (see .env.example); use pk_live_/sk_live_
```

## 5. Build + run
```bash
npm ci               # installs deps (incl. tsx used by the worker)
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup          # run the command it prints (enables restart on reboot)
```
Check both are running: `pm2 status` (web + worker should be "online").

## 6. HTTPS with Caddy
```bash
sudo nano /etc/caddy/Caddyfile     # paste the Caddyfile, set your domain
sudo systemctl reload caddy
```
Visit `https://your-domain.com` — Caddy fetches a cert automatically.

## 7. Wire the external services to production
- **MongoDB Atlas** → Network Access → allow the EC2 public IP (or 0.0.0.0/0 for
  testing).
- **iDrive e2** bucket CORS → add `https://your-domain.com` to AllowedOrigins.
- **Clerk** → make sure the Production instance is for `your-domain.com` and the
  `pk_live_/sk_live_` keys are in `.env.local`.

## Redeploying after code changes
```bash
cd app
git pull
npm ci
npm run build
pm2 reload ecosystem.config.js
```

## Notes
- Logs: `pm2 logs reelpouches-web` / `pm2 logs reelpouches-worker`.
- The worker runs the hourly expiry sweep + archive/restore jobs; it must stay
  online (pm2 handles that).
- All mock payments (deep archive, restore, regular storage) are still mock until
  Razorpay (Phase 9) is wired.
