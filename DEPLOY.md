# Deploying to AWS (single EC2 box)

One small EC2 instance runs everything: the Next.js web server, the background
worker, and Redis. MongoDB Atlas, iDrive e2, AWS S3 (Mumbai), and Clerk stay as
external services.

## 0. Before you start
- **Domain:** reelpouches.com (already purchased).
- **Clerk production keys** (`pk_live_…` / `sk_live_…`) - already in your local
  `.env.local`, commented under "#clerk auth production". Create/confirm the
  Clerk **Production** instance for reelpouches.com and add the DNS records Clerk
  gives you (clerk.*, accounts.*, etc.).
- **MongoDB, iDrive, AWS** - same values as local (reused as-is).

## 1. Launch the EC2 instance
- EC2 → Launch instance. **Ubuntu 24.04 LTS**, type **t3.small** (2 GB RAM) to
  start. Region: **ap-south-1 (Mumbai)** (same as the archive bucket).
- Create/download a key pair (for SSH).
- Security group inbound rules: **22 (SSH)**, **80 (HTTP)**, **443 (HTTPS)**.
- Give it ~20 GB disk.
- Note the instance's **public IP**.

## 2. Point your domain at it
- In your DNS provider, add an **A record**: `reelpouches.com → <public IP>`
  (and `www` → same IP if you want www).
- Also add the **Clerk production DNS records** (from the Clerk dashboard).
- (Wait a few minutes for DNS to propagate.)

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
```
Your production env is the SAME as your local `.env.local`, so copy it up - run
this **from your Mac** (not the server):
```bash
scp -i your-key.pem .env.local ubuntu@<public IP>:~/app/.env.local
```
Then on the **server**, switch Clerk to the production keys:
```bash
cd ~/app && nano .env.local
#  - put a '#' in front of the two DEVELOPMENT Clerk lines
#    (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY under "development")
#  - remove the '#' from the two lines under "#clerk auth production"
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
sudo cp ~/app/Caddyfile /etc/caddy/Caddyfile   # already set to reelpouches.com
sudo systemctl reload caddy
```
Visit `https://reelpouches.com` - Caddy fetches a cert automatically.

## 7. Wire the external services to production
- **MongoDB Atlas** → Network Access → allow the EC2 public IP (or 0.0.0.0/0 for
  testing).
- **iDrive e2** bucket CORS → add `https://reelpouches.com` to AllowedOrigins.
- **Clerk** → Production instance for reelpouches.com; prod keys active in
  `.env.local` (step 4).

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
