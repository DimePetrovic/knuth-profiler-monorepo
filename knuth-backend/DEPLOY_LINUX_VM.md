# Knuth Full Deployment On A Fresh Linux VM (Domain + HTTPS)

This guide deploys both:

- Backend (`knuth-backend`) via Docker Compose
- Frontend (`knuth-profiler`) as static Angular build behind Nginx

Target result:

- `https://your-domain.com` -> frontend
- `https://your-domain.com/api/*` -> backend API (`app.main`)

Guide assumes Ubuntu 22.04/24.04 or Debian 12.

## 1. Prerequisites

- Public Linux VM (recommended: 4 vCPU, 8-12 GB RAM, 40+ GB SSD)
- Bought domain name
- DNS management access for your domain
- SSH access to VM

## 2. DNS Setup (Domain Points To VM)

In your domain provider DNS panel create:

- `A` record: host `@` -> `YOUR_VM_PUBLIC_IP`
- `A` record: host `www` -> `YOUR_VM_PUBLIC_IP`

Wait for propagation and verify:

```bash
dig +short your-domain.com
dig +short www.your-domain.com
```

Both should return your VM IP.

## 3. Base Server Setup

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git ufw ca-certificates gnupg lsb-release nginx certbot python3-certbot-nginx
```

Optional deploy user:

```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 4. Install Docker + Compose Plugin

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

Optional (no sudo for docker):

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 5. Clone Repository

```bash
cd /opt
sudo git clone <YOUR_REPO_URL> knuth-2
sudo chown -R $USER:$USER /opt/knuth-2
```

## 6. Backend Production Compose (Do Not Expose Internal Ports Publicly)

Go to backend folder:

```bash
cd /opt/knuth-2/knuth-backend
```

Create `docker-compose.prod.yml`:

```yaml
services:
  redis:
    ports: []

  warm_joern:
    ports: []

  api:
    ports:
      - "127.0.0.1:8000:8000"

  worker:
    ports: []
```

Start backend:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Health check:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -i http://127.0.0.1:8000/docs
```

## 7. Frontend Build For Production

Go to frontend folder:

```bash
cd /opt/knuth-2/knuth-profiler
npm install
```

Important: frontend API must not stay `http://localhost:8000` in production.

In `src/app/features/cfg-import/cfg-import.api.service.ts`, set:

```ts
const API_BASE_URL = '/api';
```

Then build:

```bash
npm run build
```

Publish static files:

```bash
sudo mkdir -p /var/www/knuth-profiler
sudo rsync -a --delete /opt/knuth-2/knuth-profiler/dist/knuth-profiler/browser/ /var/www/knuth-profiler/
```

## 8. Nginx Reverse Proxy (Frontend + API)

Create `/etc/nginx/sites-available/knuth-profiler`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/knuth-profiler;
    index index.html;

    # Angular SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 5m;
}
```

Enable site and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/knuth-profiler /etc/nginx/sites-enabled/knuth-profiler
sudo nginx -t
sudo systemctl restart nginx
```

## 9. HTTPS (Let’s Encrypt)

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Pick redirect to HTTPS when prompted.

Verify renewal timer:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

## 10. Boot Persistence

### 10.1 Docker backend with systemd

Create `/etc/systemd/system/knuth-backend.service`:

```ini
[Unit]
Description=Knuth Backend Docker Compose (Prod)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/knuth-2/knuth-backend
ExecStart=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.yml -f docker-compose.prod.yml down
RemainAfterExit=yes
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable knuth-backend
sudo systemctl start knuth-backend
sudo systemctl status knuth-backend
```

### 10.2 Nginx at boot

```bash
sudo systemctl enable nginx
sudo systemctl status nginx
```

## 11. Post-Deploy Verification Checklist

- `https://your-domain.com` opens frontend
- Navigation works
- CFG upload/source submit works
- Browser network tab shows API calls to `/api/...` (not localhost)
- `https://your-domain.com/api/docs` responds

CLI checks:

```bash
curl -I https://your-domain.com
curl -I https://your-domain.com/api/docs
docker compose -f /opt/knuth-2/knuth-backend/docker-compose.yml -f /opt/knuth-2/knuth-backend/docker-compose.prod.yml ps
```

## 12. Upgrade Procedure

```bash
cd /opt/knuth-2
git pull

# rebuild backend
cd /opt/knuth-2/knuth-backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# rebuild frontend
cd /opt/knuth-2/knuth-profiler
npm install
npm run build
sudo rsync -a --delete /opt/knuth-2/knuth-profiler/dist/knuth-profiler/browser/ /var/www/knuth-profiler/

sudo nginx -t
sudo systemctl reload nginx
```

## 13. Troubleshooting

- `docker compose up --build` fails:
  - Check available RAM and disk (`free -h`, `df -h`)
  - Check exact failing service logs
- Backend is up but UI cannot call API:
  - Verify frontend uses `/api` base URL
  - Verify Nginx `location /api/` proxy block
- Jobs stuck in `queued`:
  - Check `worker` logs
  - Verify Redis health in compose
- Joern instability/restarts:
  - Increase VM RAM and swap
  - Inspect `warm_joern` container logs

Useful logs:

```bash
docker compose -f /opt/knuth-2/knuth-backend/docker-compose.yml -f /opt/knuth-2/knuth-backend/docker-compose.prod.yml logs -f api worker warm_joern
sudo journalctl -u nginx -f
```
