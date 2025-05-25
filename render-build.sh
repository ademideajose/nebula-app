#!/usr/bin/env bash

# Generate the Prisma client
npx prisma generate

# Apply migrations to ensure required tables (like Session) exist
npx prisma migrate deploy

# Build the Remix app
npm run build
