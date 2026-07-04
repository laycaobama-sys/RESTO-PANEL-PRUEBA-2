# RestoPanel · Production Deployment Guide

## Quick Start (Single Command)

```bash
npm run setup
```

This command:
1. Checks Node.js version (18+)
2. Installs npm dependencies
3. Loads .env
4. Checks Supabase connection
5. Applies pending database migrations
6. Verifies the build

## Database Migrations

### Automatic Detection
```bash
npm run db:setup
```
Detects which migrations are missing and either:
- Applies them via direct Postgres connection (if available)
- Generates `scripts/apply-missing-migrations.sql` for one-time manual paste

### Apply Pending Migrations
```bash
npm run db:apply
```
Generates the SQL file and opens the Supabase SQL Editor in your browser.

## Pre-deployment Checks
```bash
npm run predeploy
```
Verifies:
- Environment variables
- TypeScript compilation
- Build
- Database migrations
- Security scan (hardcoded secrets, exposed credentials)

## Deploy to Cloudflare Pages
```bash
npm run deploy:cf
```
Requires:
- `CLOUDFLARE_API_TOKEN` in .env
- `CLOUDFLARE_ACCOUNT_ID` in .env

## DNS Setup for Email (Resend)
```bash
npm run dns:setup
```
Creates SPF, DKIM, DMARC, and MX records for your domain in Cloudflare.
After running, verify the domain at https://resend.com/domains

## Testing

### Email Service
```bash
npm run test:email
```
Sends a test email via Resend and verifies delivery.

### WhatsApp Service
```bash
npm run test:whatsapp
```
Verifies WhatsApp configuration and API connection.

### Smoke Test
```bash
npm run smoke-test
```
Runs comprehensive tests against a running instance.

## Backup & Restore

### Backup
```bash
npm run backup
```
Exports all database tables to `backups/backup-<timestamp>.json`.

### Restore
```bash
npm run restore backups/backup-<timestamp>.json
```
Restores from a JSON backup file.

## Rollback
```bash
npm run rollback
```
Lists recent deployments and provides rollback instructions.

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `NEXTAUTH_SECRET` | NextAuth JWT secret |
| `NEXTAUTH_URL` | App URL (e.g., https://restopanel.com) |

### Email (Resend)
| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `FROM_EMAIL` | From email address |

### WhatsApp (Meta Cloud API)
| Variable | Description |
|----------|-------------|
| `WHATSAPP_TOKEN` | Permanent access token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token |

### Cloudflare
| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml`:
- Runs on every push to `main`
- TypeScript check, lint, build
- Deploys to Cloudflare Pages on successful build

Required GitHub secrets:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
