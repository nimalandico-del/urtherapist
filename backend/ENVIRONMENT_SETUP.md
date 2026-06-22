# Environment Configuration Guide

This project supports switching between local development and production environments via terminal commands.

## Quick Start

### Local Development Mode

**Windows (PowerShell):**
```powershell
.\run_local.ps1
```

**Linux/Mac (Bash):**
```bash
./run_local.sh
```

**Manual (any platform):**
```bash
$env:ENVIRONMENT="local"  # PowerShell
# or
export ENVIRONMENT=local  # Bash
python manage.py runserver
```

### Production Mode

**Windows (PowerShell):**
```powershell
.\run_production.ps1
```

**Linux/Mac (Bash):**
```bash
./run_production.sh
```
.\run_local.ps1 migrate
.\run_local.ps1 runserver
.\run_local.ps1 createsuperuser

Or manually set the environment:
$env:ENVIRONMENT="local"python manage.py migrate

**Manual (any platform):**
```bash
$env:ENVIRONMENT="production"  # PowerShell
# or
export ENVIRONMENT=production  # Bash
python manage.py runserver
```

## Environment Differences

### Local Development (`ENVIRONMENT=local`)
- **Database**: SQLite (default) or local PostgreSQL (if `DB_ENGINE=postgresql`)
- **Channel Layer**: In-Memory (no Redis required)
- **Storage**: **Liara Object Storage** (always enabled)
- **DEBUG**: Enabled by default

### Production (`ENVIRONMENT=production`)
- **Database**: Liara PostgreSQL (production database)
- **Channel Layer**: Redis (Liara private network)
- **Storage**: **Liara Object Storage** (always enabled)
- **DEBUG**: Disabled by default

## Important Notes

⚠️ **Liara Storage is ALWAYS enabled** regardless of environment. This ensures consistent file storage behavior across all environments.

## Running Commands

You can run any Django management command with the environment scripts:

```powershell
# Local mode
.\run_local.ps1 migrate
.\run_local.ps1 createsuperuser
.\run_local.ps1 shell

# Production mode
.\run_production.ps1 migrate
.\run_production.ps1 collectstatic
```

## Local Database Options

### Option 1: SQLite (Default)
No configuration needed. Database file will be created at `backend/db.sqlite3`.

### Option 2: Local PostgreSQL
Set the following environment variables:
```bash
export DB_ENGINE=postgresql
export DB_NAME=urtherapist_local
export DB_USER=postgres
export DB_PASSWORD=your_password
export DB_HOST=localhost
export DB_PORT=5432
```

Then run:
```bash
.\run_local.ps1 migrate
```

## Environment Variables

You can override any setting using environment variables:

- `ENVIRONMENT`: `local` or `production` (default: `production`)
- `DEBUG`: `1` or `0` (default: `1` for local, `0` for production)
- `DB_ENGINE`: `sqlite3` or `postgresql` (only for local, default: `sqlite3`)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`: Database credentials
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Redis configuration (production only)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: Liara storage credentials (always required)

