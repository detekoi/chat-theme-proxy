# Chat Theme Proxy - Guidelines

## Commands
- `npm start` - Start server locally (port 8091)
- `./deploy.sh` - Deploy to Cloud Run manually (requires GCP project: chat-themer)

## Environment Variables
- `PORT` - Server port (default: 8091)
- `GEMINI_API_KEY` - Required Gemini API key

## Architecture

### Theme Proxy (Cloud Run)
Two-step theme generation:
1. **Step 1**: `gemini-flash-lite-latest` generates theme JSON with structured output (includes `image_prompt`)
2. **Step 2**: `gemini-2.5-flash-image` generates background pattern using `image_prompt` from Step 1

Structured output with JSON schema ensures reliable parsing. Reduced retries from 5→3 attempts.

### Badge Proxy (Cloud Functions 2nd gen)
Three HTTP Cloud Functions in `functions/badge-proxy/` that proxy Twitch Badge API calls:
- **getGlobalBadges** - Fetches and caches global Twitch badges (12h TTL)
- **getChannelBadges** - Fetches and caches channel-specific badges (1h TTL)
- **refreshGlobalCache** - Admin endpoint to force-refresh global badge cache (requires auth)

All badge data is cached in Firestore (`twitchBadgeCache` collection). Twitch app access tokens are also cached in Firestore with auto-refresh.

## Code Style
- CommonJS modules (require/exports)
- Async/await pattern with try/catch error handling
- camelCase for variables/functions, UPPER_SNAKE_CASE for env vars
- Semantic HTTP status codes (400 client errors, 500 server errors)

## Deployment
- **Cloud Run URL**: https://theme-proxy-361545143046.us-central1.run.app
- **GCP Project**: chat-themer
- **Region**: us-central1
- **CI/CD**: GitHub Actions deploys both Cloud Run and Cloud Functions on push to `main`

## Repo Structure
```
├── index.js              # Express app entrypoint (Cloud Run)
├── routes/               # API route handlers
├── services/             # Theme generation, fonts, images
├── config/               # Constants, presets
├── functions/
│   └── badge-proxy/      # Cloud Functions (2nd gen) source
│       ├── index.js      # getGlobalBadges, getChannelBadges, refreshGlobalCache
│       └── package.json  # Function-specific dependencies
└── .github/workflows/
    └── deploy.yml        # CI/CD for Cloud Run + Cloud Functions
```
