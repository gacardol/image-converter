#!/bin/bash
# Build script for production deployment (Render, etc.)

echo "=== Installing server dependencies ==="
cd server
npm install

echo "=== Installing client dependencies ==="
cd ../client
npm install

echo "=== Building frontend ==="
npm run build

echo "=== Copying build to server/public ==="
mkdir -p ../server/public
cp -r dist/* ../server/public/

echo "=== Build complete ==="
