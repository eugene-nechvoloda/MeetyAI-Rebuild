#!/bin/bash
# Startup script for Railway deployment
# Ensures database schema is created before starting the server

set -e

echo "🔍 Checking database schema..."

# Push schema to database (creates tables if they don't exist)
npx prisma db push --accept-data-loss --skip-generate

echo "✅ Database schema ready!"
echo "🚀 Starting MeetyAI server..."

# Start the Node.js server
node dist/index.js
