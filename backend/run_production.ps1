# PowerShell script to run Django server in production mode
# Usage: .\run_production.ps1 [command]
# Example: .\run_production.ps1 runserver
# Example: .\run_production.ps1 migrate

$env:ENVIRONMENT = "production"
$env:DEBUG = "0"

if ($args.Count -eq 0) {
    Write-Host "Starting Django server in PRODUCTION mode..."
    Write-Host "Environment: PRODUCTION"
    Write-Host "Database: Liara PostgreSQL"
    Write-Host "Channel Layer: Redis"
    Write-Host "Storage: Liara (always enabled)"
    Write-Host ""
    python manage.py runserver
} else {
    $command = $args -join " "
    Write-Host "Running command in PRODUCTION mode: python manage.py $command"
    Write-Host "Environment: PRODUCTION"
    Write-Host ""
    python manage.py $command
}

