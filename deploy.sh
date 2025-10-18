#!/bin/bash
set -e

# Exit immediately if any command fails
set -e

echo "Starting deployment process for Chat Theme Proxy..."

# Environment validation
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY environment variable not set."
  echo "Please set this variable before running the deployment script."
  exit 1
fi

# Configure Docker to use the gcloud command-line tool as a credential helper
echo "Configuring Docker to use gcloud as credential helper..."
gcloud auth configure-docker us-west2-docker.pkg.dev

# Build the container image
echo "Building container image..."
gcloud builds submit --tag us-west2-docker.pkg.dev/chat-themer/chat-theme-repo/theme-proxy:v1

# Deploy to Cloud Run
echo "Deploying to Cloud Run in us-west2..."
gcloud run deploy theme-proxy \
  --image us-west2-docker.pkg.dev/chat-themer/chat-theme-repo/theme-proxy:v1 \
  --region us-west2 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,RUNWARE_API_KEY=RUNWARE_API_KEY:latest

echo "Deployment completed successfully!"
echo "Your application should be available soon at the URL shown above."