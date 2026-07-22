#!/bin/sh
set -e
cd /app/packages/database
npx prisma migrate deploy
npx tsx prisma/seed.ts || true
cd /app
exec node apps/api/dist/main.js
