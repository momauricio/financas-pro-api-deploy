# Finanças Pro — API

Backend Node (Fastify + Prisma) do Finanças Pro. Repositório **separado** do frontend (`lcht1/financas-pro`).

> **Owner:** `lcht1/financas-pro-api`. Incluir no GitHub App Cursor (selected repos) para `gh` push.

## Auth

- Login/sessão no **frontend** via Supabase Auth client (anon key pública).
- A API **não** recebe senha: valida o JWT (`Authorization: Bearer <access_token>`) via JWKS ES256.
- Segredos (`DATABASE_URL`, service keys, `BRAPI_TOKEN`) ficam **somente** neste repo / VPS — nunca em `VITE_*`.

## Setup local

```bash
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

Health: `GET http://localhost:3001/health`  
Docs: `http://localhost:3001/docs`

## CORS

`CORS_ORIGIN` (vírgula) deve incluir os hosts Vercel do front + `http://localhost:5173`. Em produção, acrescente o domínio custom se houver. Ver `.env.example`.

## Módulos

| Módulo | Status |
|--------|--------|
| categories | ✅ |
| auth `/me` | ✅ stub |
| credit-cards | ✅ |
| invoice-payments | ✅ |
| goals | ✅ |
| profile | ✅ |
| transactions | ✅ |
| investments | ✅ |
| aggregates | ✅ |
| price-alerts (+ offers/average) | ✅ |

## Deploy

Guia completo: **[docs/deploy.md](./docs/deploy.md)** (Dockerfile, PM2 `ecosystem.config.cjs`, Nginx/Certbot, CORS prod).

**Bloqueio atual:** sem host/SSH no Agent Store — Mauricio precisa fornecer acesso à VPS (ou Hostinger VPS API autenticada) antes do go-live. Depois: setar `VITE_API_URL` no Vercel do front.
