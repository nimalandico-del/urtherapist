#!/bin/bash
# Bash script to run Django server in production mode
# Usage: ./run_production.sh [command]
# Example: ./run_production.sh runserver
# Example: ./run_production.sh migrate

export ENVIRONMENT=production
export DEBUG=0

if [ $# -eq 0 ]; then
    echo "Starting Django server in PRODUCTION mode..."
    echo "Environment: PRODUCTION"
    echo "Database: Liara PostgreSQL"
    echo "Channel Layer: Redis"
    echo "Storage: Liara (always enabled)"
    echo ""
    python manage.py runserver
else
    echo "Running command in PRODUCTION mode: python manage.py $@"
    echo "Environment: PRODUCTION"
    echo ""
    python manage.py "$@"
fi

