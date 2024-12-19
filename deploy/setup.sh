#!/bin/bash

# Print commands and exit on error
set -ex

echo "Installing system dependencies..."
# Install FFmpeg for thumbnail generation
sudo apt-get update
sudo apt-get install -y ffmpeg

echo "Installing Node.js dependencies..."
npm install

echo "Setting up PostgreSQL database..."
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

# Initialize database schema
echo "Initializing database schema..."
npm run db:push

echo "Creating required directories..."
mkdir -p public/thumbnails

echo "Setup completed successfully!"
echo "To start the application, run: npm run dev"
