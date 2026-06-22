# PowerShell script to run Django server in local development mode
# Usage: .\run_local.ps1 [command]
# Example: .\run_local.ps1 runserver
# Example: .\run_local.ps1 migrate

$env:ENVIRONMENT = "local"
$env:DEBUG = "1"

if ($args.Count -eq 0) {
    Write-Host "Starting Django development server in LOCAL mode..."
    Write-Host "Environment: LOCAL"
    Write-Host "Database: SQLite (or set DB_ENGINE=postgresql for PostgreSQL)"
    Write-Host "Channel Layer: In-Memory"
    Write-Host "Storage: Liara (always enabled)"
    Write-Host ""
    python manage.py runserver
} else {
    $command = $args -join " "
    Write-Host "Running command in LOCAL mode: python manage.py $command"
    Write-Host "Environment: LOCAL"
    Write-Host ""
    python manage.py $command
}

