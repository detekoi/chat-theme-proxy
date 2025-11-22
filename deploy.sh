#!/bin/bash
# Exit immediately if any command fails
set -e

echo "Starting deployment process for Chat Theme Proxy..."

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
  echo "Error: gcloud CLI is not installed."
  echo "Please install it from: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Check if user is authenticated with gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo "Error: Not authenticated with gcloud."
  echo "Please run: gcloud auth login"
  exit 1
fi

# Set the correct GCP project
PROJECT_ID="chat-themer"
echo "Setting GCP project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID || {
  echo "Error: Failed to set project to $PROJECT_ID."
  echo "Please ensure you have access to this project."
  exit 1
}

# Environment validation
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY environment variable not set."
  echo "Please set this variable before running the deployment script."
  exit 1
fi

# Note: RUNWARE_API_KEY is also required but will be provided via secrets
# The script assumes secrets are already created in Google Cloud Secret Manager

# Configure Docker to use the gcloud command-line tool as a credential helper
echo "Configuring Docker to use gcloud as credential helper..."
gcloud auth configure-docker us-central1-docker.pkg.dev || {
  echo "Warning: Failed to configure Docker credential helper. Continuing anyway..."
}

# Build the container image
echo "Building container image..."
gcloud builds submit --project=$PROJECT_ID --tag us-central1-docker.pkg.dev/chat-themer/chat-theme-repo/theme-proxy:v1 || {
  echo "Error: Failed to build container image."
  exit 1
}

# Deploy to Cloud Run
echo "Deploying to Cloud Run in us-central1..."
gcloud run deploy theme-proxy \
  --project=$PROJECT_ID \
  --image us-central1-docker.pkg.dev/chat-themer/chat-theme-repo/theme-proxy:v1 \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,RUNWARE_API_KEY=RUNWARE_API_KEY:latest || {
  echo "Error: Failed to deploy to Cloud Run."
  exit 1
}

echo "Deployment completed successfully!"
echo "Your application should be available soon at the URL shown above."