#!/bin/bash
# Startup script for Liara deployment
# This script runs migrations and starts the server

set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput || true

echo "Starting server..."
exec "$@"

