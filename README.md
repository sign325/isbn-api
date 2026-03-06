# isbn-api

API do metadanych książek. Scraping lubimyczytac.pl + enrichment z empik.com i buybox.click.

## Stack

- TypeScript/Node.js, Hono (HTTP), Redis (cache 30d), Patchright (browser automation), undici ProxyAgent

## Endpointy

Wszystko za basic auth (`AUTH_USER`/`AUTH_PASS`).

- `GET /isbn/:isbn` — książka po ISBN (10 lub 13 cyfr)
- `GET /?fetch=<url>` — dowolny URL z lubimyczytac.pl (książka lub katalog)
- `GET /latest?page=1&sort=published-desc` — katalog najnowszych
- `GET /new?page=1&sort=published-desc` — nowości
- `GET /proxy?url=<url>` — proxy obrazków (whitelist: lubimyczytac.pl, ecsmedia.pl)

## Jak działa

1. Fetch HTML z lubimyczytac.pl → regex parsing (brak DOM parsera)
2. Parallel: bookstores z buybox.click API, empik enrichment (cover HD, wymiary, język oryginalny)
3. Sequential z 300ms delay: inne edycje, autor, wydawca
4. Empik przez Patchright (headless Chromium) bo Cloudflare
5. Obrazki przepisane na `/proxy` endpoint

## Proxy

**Każdy** request (fetch + browser) leci przez IPRoyal proxy. Konfiguracja w `PROXY_URL` env var. Serwer nie wystartuje jeśli proxy nie działa. Globalny `fetch()` jest nadpisany — rzuca error jeśli dispatcher nie jest ProxyAgent.

## Deploy

```
docker compose up -d --build
```

Zmień `AUTH_PASS` w `docker-compose.yml`.

## Dev

```
AUTH_PASS=dev npm run dev
```

Wymaga Redis na localhost:6379.

## Env vars

| Var | Default | Opis |
|-----|---------|------|
| `AUTH_PASS` | **wymagany** | Hasło basic auth |
| `AUTH_USER` | `isbn` | Login basic auth |
| `PROXY_URL` | IPRoyal hardcoded | HTTP proxy URL z auth |
| `REDIS_URL` | `redis://localhost:6379` | Redis |
| `PORT` | `2137` | Port serwera |

## Struktura

```
src/
  index.ts    — router, endpointy, enrichment pipeline
  parsers.ts  — regex HTML parsing, fetch helpers (autor, wydawca, bookstores, ISBN)
  empik.ts    — Patchright browser, Cloudflare bypass, empik page parsing
  proxy.ts    — globalny ProxyAgent, startup verification, fetch guard
  cache.ts    — Redis get/set/flush, graceful degradation
  types.ts    — interfejsy TypeScript
```
