#!/bin/bash
# Bash script to run Django server in local development mode
# Usage: ./run_local.sh [command]
# Example: ./run_local.sh runserver
# Example: ./run_local.sh migrate

export ENVIRONMENT=local
export DEBUG=1

if [ $# -eq 0 ]; then
    echo "Starting Django development server in LOCAL mode..."
    echo "Environment: LOCAL"
    echo "Database: SQLite (or set DB_ENGINE=postgresql for PostgreSQL)"
    echo "Channel Layer: In-Memory"
    echo "Storage: Liara (always enabled)"
    echo ""
    python manage.py runserver
else
    echo "Running command in LOCAL mode: python manage.py $@"
    echo "Environment: LOCAL"
    echo ""
    python manage.py "$@"
fi

