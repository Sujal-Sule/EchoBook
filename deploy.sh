#!/bin/bash
# EchoBook automated deployment script
echo "Deploying EchoBook backend to Render..."
git push render main
echo "Deploying EchoBook frontend to Vercel..."
vercel --prod
echo "Deployment complete ✅"