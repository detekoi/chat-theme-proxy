# Chat Theme Proxy - Claude Guidelines

## Commands
- `npm start` - Start server locally (port 8091)
- `./deploy.sh` - Deploy to Cloud Run (requires GCP project: chat-themer)

## Environment Variables
- `PORT` - Server port (default: 8091)
- `GEMINI_API_KEY` - Required Gemini API key

## Architecture
Two-step theme generation:
1. **Step 1**: `gemini-2.5-flash-lite` generates theme JSON with structured output (includes `image_prompt`)
2. **Step 2**: `gemini-2.5-flash-image` generates background pattern using `image_prompt` from Step 1

Structured output with JSON schema ensures reliable parsing. Reduced retries from 5→3 attempts.

## Code Style
- CommonJS modules (require/exports)
- Async/await pattern with try/catch error handling
- camelCase for variables/functions, UPPER_SNAKE_CASE for env vars
- Semantic HTTP status codes (400 client errors, 500 server errors)

## Deployment
- Cloud Run URL: (Update after deployment)
- GCP Project: chat-themer
- Region: us-central1
