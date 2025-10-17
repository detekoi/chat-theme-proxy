# Chat Theme Proxy - Claude Guidelines

## Commands
- `npm start` - Start the server locally (runs on port 8091 by default)
- `docker build -t chat-theme-proxy .` - Build Docker image
- `docker run -p 8091:8091 -e GEMINI_API_KEY=your-key chat-theme-proxy` - Run in Docker

## Environment Variables
- `PORT` - Server port (default: 8091)
- `GEMINI_API_KEY` - Required API key for Gemini

## Recent Updates (October 2025)

### Migration to Two-Step Generation with Structured Output

The service now uses a **two-step approach** combining two Gemini models:

**Architecture:**
1. **Step 1 - Theme Data** (`gemini-2.5-flash-lite-preview-09-2025`)
   - Generates theme JSON with structured output
   - Includes `image_prompt` field for Step 2
   - JSON schema validation ensures consistent format
   
2. **Step 2 - Image Generation** (`gemini-2.5-flash-image`)
   - Generates background pattern image
   - Uses `image_prompt` from Step 1
   - Only called when `themeType === 'image'`

**Why Two Steps?**
- `gemini-2.5-flash-image` doesn't support JSON mode/structured output
- Separating concerns allows both reliable JSON and quality images
- Each model optimized for its specific task

**Key Improvements:**
- **Structured Output**: JSON schema validation for guaranteed format compliance
- **Reduced Retries**: Decreased from 5 to 3 attempts due to reliable JSON parsing
- **Simplified Code**: Removed ~100 lines of complex JSON parsing logic
- **Better Reliability**: Enum constraints ensure valid values
- **Optimized Image Generation**: Dedicated model with AI-generated prompts

**Technical Changes:**
- Step 1: `gemini-2.5-flash-lite-preview-09-2025` with `responseSchema` and `responseMimeType: "application/json"`
- Step 2: `gemini-2.5-flash-image` for image generation (no structured output needed)
- Added `image_prompt` field to JSON schema
- Separated API calls for better error handling
- Updated all test endpoints for two-step verification

## Code Style
- Use CommonJS for modules (require/exports)
- Error handling with try/catch blocks and useful error messages
- HTTP status codes should be semantically correct (400 for client errors, 500 for server)
- Consistent async/await pattern for promises
- Use camelCase for variables and functions
- Use UPPER_SNAKE_CASE for environment variables
- Proper HTTP request validation before processing

## Project Structure
- Simple Express server with API endpoints and error handling
- Security considerations: Environment variables for secrets
- JSON responses with consistent format