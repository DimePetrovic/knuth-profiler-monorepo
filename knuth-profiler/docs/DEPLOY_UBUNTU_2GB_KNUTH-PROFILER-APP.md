# Deploy Runbook: Ubuntu 2GB VM + knuth-profiler.app

Ovaj runbook je prilagodjen za prazan Ubuntu VM sa 2GB RAM, upload preko WinSCP i domen `knuth-profiler.app`.

## 1) Sta deploy-ujemo

- Backend (`knuth-backend`) preko Docker Compose:
  - `redis`
  - `warm_joern`
  - `api`
  - `worker`
- Frontend (`knuth-profiler`) kao staticki Angular build iza Nginx.

Cilj:
- `https://knuth-profiler.app/` -> frontend
- `https://knuth-profiler.app/api/*` -> backend API

## 2) DNS

U DNS panelu domena podesi:
- `A @` -> javna IP adresa VM
- `A www` -> javna IP adresa VM

Provera:
```bash
dig +short knuth-profiler.app
dig +short www.knuth-profiler.app
```

## 3) Inicijalni setup servera (Ubuntu)

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl ca-certificates gnupg lsb-release nginx certbot python3-certbot-nginx ufw rsync
```

Firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

## 4) Docker + Compose plugin

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

## 5) VM sa 2GB RAM: obavezno swap

Joern + build umeju da potrose memoriju. Dodaj 4GB swap:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 6) Upload projekta preko WinSCP

Sa Windows racunara:
- konektuj se na VM preko SFTP (port 22)
- prebaci folder `knuth-2` u `/opt/knuth-2`

Na serveru:
```bash
sudo mkdir -p /opt/knuth-2
sudo chown -R $USER:$USER /opt/knuth-2
```

Ako WinSCP prebaci pod drugim vlasnikom:
```bash
sudo chown -R $USER:$USER /opt/knuth-2
```

## 7) Backend env i start

Kreiraj env fajl iz sablona:

```bash
cd /opt/knuth-2/knuth-backend
cp .env.example .env
```

Za production promeni CORS u:
```env
CORS_ALLOWED_ORIGINS=https://knuth-profiler.app,https://www.knuth-profiler.app
```

Start backenda:
```bash
cd /opt/knuth-2/knuth-backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Provera:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -i http://127.0.0.1:8000/docs
```

## 8) Frontend build i publish

`cfg-import.api.service.ts` vec koristi Angular environment fajlove:
- dev: `http://localhost:8000`
- prod: `/api`

Build i kopiranje:
```bash
cd /opt/knuth-2/knuth-profiler
npm install
npm run build

sudo mkdir -p /var/www/knuth-profiler
sudo rsync -a --delete /opt/knuth-2/knuth-profiler/dist/knuth-profiler/browser/ /var/www/knuth-profiler/
```

## 9) Nginx konfiguracija

Kreiraj:
`/etc/nginx/sites-available/knuth-profiler`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name knuth-profiler.app www.knuth-profiler.app;

    root /var/www/knuth-profiler;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

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

Aktivacija:
```bash
sudo ln -sf /etc/nginx/sites-available/knuth-profiler /etc/nginx/sites-enabled/knuth-profiler
sudo nginx -t
sudo systemctl restart nginx
```

## 10) HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d knuth-profiler.app -d www.knuth-profiler.app
sudo certbot renew --dry-run
```

## 11) Boot persistence

Backend systemd unit:

`/etc/systemd/system/knuth-backend.service`
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

Aktivacija:
```bash
sudo systemctl daemon-reload
sudo systemctl enable knuth-backend
sudo systemctl start knuth-backend
sudo systemctl enable nginx
```

## 12) Sanity checklist

- `https://knuth-profiler.app` otvara frontend
- API ide na `/api/...` (ne localhost)
- Upload/source submit radi
- `https://knuth-profiler.app/api/docs` radi

Brze komande:
```bash
curl -I https://knuth-profiler.app
curl -I https://knuth-profiler.app/api/docs
docker compose -f /opt/knuth-2/knuth-backend/docker-compose.yml -f /opt/knuth-2/knuth-backend/docker-compose.prod.yml ps
```

## 13) Update procedura

```bash
# Upload novog koda preko WinSCP u /opt/knuth-2

cd /opt/knuth-2/knuth-backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

cd /opt/knuth-2/knuth-profiler
npm install
npm run build
sudo rsync -a --delete /opt/knuth-2/knuth-profiler/dist/knuth-profiler/browser/ /var/www/knuth-profiler/

sudo nginx -t
sudo systemctl reload nginx
```
