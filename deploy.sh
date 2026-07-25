#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "🐝 Melakukan penarikan kode terbaru dari repositori..."
git pull origin main

echo "🐝 Memasang dependensi Node.js..."
npm i

echo "🐝 Membangun bundle produksi (build)..."
npm run build

echo "🐝 Memulai ulang aplikasi BeeChat di PM2..."
pm2 restart 0

echo "🐝 Selesai! Aplikasi BeeChat berhasil dideploy ke server. 🍯🐝"
