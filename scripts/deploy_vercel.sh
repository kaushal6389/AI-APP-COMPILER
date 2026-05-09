#!/usr/bin/env bash
# Helper: Deploy monorepo frontend to Vercel using Vercel CLI
# Usage: ./scripts/deploy_vercel.sh <vercel-project-name> [--prod]
PROJ_NAME="$1"
PROD_FLAG="$2"
if [ -z "$PROJ_NAME" ]; then
  echo "Usage: $0 <vercel-project-name> [--prod]"
  exit 1
fi
# Build frontend
echo "Building frontend..."
cd apps/frontend || exit 2
npm install
npm run build
cd -
# Deploy with Vercel
if [ "$PROD_FLAG" = "--prod" ]; then
  vercel --prod --confirm --name "$PROJ_NAME"
else
  vercel --confirm --name "$PROJ_NAME"
fi
