# Deploy da API — Finanças Pro

Guia de preparação. **Deploy real na VPS exige SSH/host do Mauricio** — não há chave SSH nem IP no Agent Store (`internal/`) nem em env deste agente.

## Pré-requisitos

| Item | Onde |
|------|------|
| Repo | `lcht1/financas-pro-api` (`main` com modules categories→offers) |
| Node | ≥ 20 |
| Secrets | só no servidor: `DATABASE_URL`, `CORS_ORIGIN`, `SUPABASE_URL`, opcional `BRAPI_TOKEN` |
| Front | Vercel — setar `VITE_API_URL` para a URL HTTPS pública da API |

## CORS (produção)

Em `.env` da VPS, `CORS_ORIGIN` (vírgula, sem espaços extras desnecessários) deve incluir **todos** os hosts do front:

```
CORS_ORIGIN=https://financas-pro-five.vercel.app,https://financas-pro-kappa.vercel.app,https://financas-pro-mauricio20.vercel.app,https://SEU-DOMINIO-CUSTOM.com
```

O `.env.example` já lista os três previews Vercel + localhost. Ao apontar um domínio custom no front, **adicione-o** aqui antes do go-live.

## Opção A — Docker

```bash
git clone https://github.com/lcht1/financas-pro-api.git
cd financas-pro-api
cp .env.example .env   # preencher DATABASE_URL etc.
docker build -t financas-pro-api .
docker run -d --name financas-pro-api --restart unless-stopped \
  --env-file .env -p 127.0.0.1:3001:3001 financas-pro-api
```

Health: `curl -s http://127.0.0.1:3001/health`

## Opção B — PM2 (Node nativo)

```bash
git clone https://github.com/lcht1/financas-pro-api.git /opt/financas-pro-api
cd /opt/financas-pro-api
cp .env.example .env   # secrets
npm ci
npx prisma generate
npm run build
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # seguir o comando impresso
```

## Nginx (TLS na frente)

Exemplo de site (ajuste `api.seudominio.com` e path do Certbot):

```nginx
server {
  listen 80;
  server_name api.seudominio.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.seudominio.com;

  # ssl_certificate     /etc/letsencrypt/live/api.seudominio.com/fullchain.pem;
  # ssl_certificate_key /etc/letsencrypt/live/api.seudominio.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Certbot: `sudo certbot --nginx -d api.seudominio.com`

Firewall: abrir 80/443; **não** expor 3001 publicamente se Nginx fizer o proxy.

## Front (Vercel)

1. Project env: `VITE_API_URL=https://api.seudominio.com` (sem barra final).
2. Redeploy do front.
3. Confirmar login → Bearer JWT → `GET /api/v1/categories` 200.

## Próximo passo do Mauricio (bloqueio)

1. Enviar **host SSH** (IP/domínio) + usuário + chave (ou senha via canal seguro) — colar em `internal/` do store **ou** env do agente.
2. Ou adicionar a chave pública do agente / Hostinger VPS API se a VM já existir no painel Hostinger.
3. Incluir `financas-pro-api` nos selected repos do GitHub App Cursor (hoje `gh` App token dá 404; push via OAuth MCP ok).
4. Definir hostname público (`api.…`) e DNS A/AAAA apontando para a VPS.
