# Twitch Chat Theme Generator Proxy

A simple Express server that acts as a proxy for the Gemini API, generating Twitch chat themes for my [Twitch Chat Overlay](https://github.com/detekoi/compact-chat-overlay) based on user prompts.

## Features

- Secure server-side API key handling for Gemini API
- Theme generation based on text prompts
- Expanded font selection including custom fonts
- Test interface for trying the theme generator
- AI-generated tiled background patterns that match the theme

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

## Running the Server

For development (with auto-restart on file changes):
```
npm run dev
```

For production:
```
npm start
```

The server will start on port 8091 by default. You can change this by setting the `PORT` environment variable.

## Testing

Access the test interface at http://localhost:8091 after starting the server.

## API Endpoints

- `GET /` - Test interface for theme generation
- `GET /health` - Health check endpoint
- `POST /api/generate-theme` - Generate a theme based on a prompt
- `GET /api/fonts` - Get list of available fonts

## Docker

Build the Docker image:
```
docker build -t chat-theme-proxy .
```

Run the container:
```
docker run -p 8091:8091 -e GEMINI_API_KEY=your_api_key_here chat-theme-proxy
```

## Google Cloud Platform Deployment

### Manual Deployment via Script

1. Install and set up the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

2. Set your Gemini API key as an environment variable:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```

3. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

The script will:
- Validate environment variables
- Configure Docker authentication for GCP
- Build and push the container image
- Deploy to Cloud Run with appropriate settings

### GitHub Actions Deployment

For automated deployments via GitHub Actions, you'll need to set up the following secrets in your GitHub repository:

1. Go to your repository Settings → Secrets and Variables → Actions
2. Add the following secrets:
   - `GCP_PROJECT_ID`: Your Google Cloud Project ID
   - `GCP_SA_KEY`: Your Google Cloud Service Account key JSON
   - `GEMINI_API_KEY`: Your Gemini API key

The workflow will automatically:
- Build and push the Docker image to Google Artifact Registry
- Deploy to Cloud Run on every push to the main branch
- Configure environment variables and secrets
- Set up public access to the service

### Required GCP Setup

Before deploying, ensure you have:

1. Created a Google Cloud Project
2. Enabled the following APIs:
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API
3. Created a Service Account with the following roles:
   - Cloud Run Admin
   - Cloud Build Service Account
   - Service Account User
   - Artifact Registry Writer
4. Generated and downloaded the Service Account key JSON

## Live Deployment

The service is currently deployed and available at:
**https://theme-proxy-361545143046.us-west2.run.app**

### API Usage

Generate a theme with background image:
```bash
curl -X POST https://theme-proxy-361545143046.us-west2.run.app/api/generate-theme \
  -H "Content-Type: application/json" \
  -d '{"prompt":"cozy cabin","themeType":"image","attempt":0}'
```

Generate a text-only theme:
```bash
curl -X POST https://theme-proxy-361545143046.us-west2.run.app/api/generate-theme \
  -H "Content-Type: application/json" \
  -d '{"prompt":"cyberpunk neon","themeType":"color","attempt":0}'
```

## Background Image Implementation

### Overview

The theme generator uses Gemini 2.5 Flash Image (`gemini-2.5-flash-image`) with structured output to create subtle tiled background patterns that match the theme generated from the user's prompt. The service uses the Gemini REST API directly for optimal compatibility and reliability.

### Technical Details

#### Image Format and Storage

- Images are returned from Gemini as base64-encoded PNG data
- These are included in the API response as `backgroundImage.data` and `backgroundImage.mimeType`
- The data can be used directly in CSS as `data:image/png;base64,{data}`

#### CSS Implementation

The background patterns are implemented by [Chat Overlay](https://github.com/detekoi/compact-chat-overlay) using pseudo-elements with the following CSS properties:

For chat windows (using `::before` on `#chat-wrapper`):
```css
content: '';
position: absolute;
inset: 0;
background-image: var(--chat-bg-image, none);
background-repeat: repeat;
background-size: contain;
z-index: 1; /* Above background color, below container */
border-radius: inherit;
pointer-events: none;
```

For popup messages (using `::after` on `.popup-message`):
```css
content: "";
position: absolute;
inset: 0;
background-image: var(--popup-bg-image, none);
background-repeat: repeat;
background-size: 320px;
z-index: -1;
border-radius: inherit;
pointer-events: none;
```

#### API Response Structure

The API returns a JSON object with the following structure:

```json
{
  "themeData": {
    "theme_name": "Whispering Pines",
    "background_color": "rgba(40, 30, 25, 0.8)",
    "border_color": "#a08060",
    "text_color": "#f0f0e8",
    "username_color": "#d2b48c",
    "font_family": "Georgia",
    "border_radius": "Subtle",
    "box_shadow": "Soft",
    "description": "Embrace the warmth of a secluded retreat with this cozy wood-toned chat theme.",
    "border_radius_value": "8px",
    "box_shadow_value": "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px"
  },
  "backgroundImage": {
    "mimeType": "image/png",
    "data": "iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zU..."
  },
  "maxAttemptsReached": false,
  "noImageAvailable": false
}
```

### Customization

#### Image Size

The default tile size is set to 320px. This can be adjusted by changing the `background-size` property in the CSS.

#### Request Parameters

- `prompt`: String describing the desired theme (e.g., "cozy cabin", "cyberpunk neon")
- `themeType`: "image" for themes with background images, "color" for color-only themes
- `attempt`: Number indicating retry attempt (usually 0 for first request)

#### Disabling Background Images

To generate themes without background images, set `themeType: "color"` in your request.

### Troubleshooting

#### Image Not Appearing

If the background image doesn't appear:

1. Check the browser console for errors
2. Verify that the CSS variable is being set correctly
3. Ensure the data URL is valid and contains the correct MIME type
4. Try adjusting the opacity of the background color to make the pattern more visible

#### Performance Issues

If you experience performance issues with background images:

1. Use `themeType: "color"` for faster generation without images
2. Cache generated themes on the client side to avoid repeated API calls

## Implementation Notes

### Two-Step Generation Process

The service uses a **two-step approach** combining two Gemini models:

#### Step 1: Theme Data Generation (gemini-2.5-flash-lite)
- **Model**: `gemini-2.5-flash-lite-preview-09-2025`
- **Purpose**: Generate theme JSON data + image prompt
- **Features**: 
  - Structured output with JSON schema validation
  - Response MIME Type: `application/json`
  - Guaranteed consistent format
  - Includes `image_prompt` field for Step 2

#### Step 2: Image Generation (gemini-2.5-flash-image) 
- **Model**: `gemini-2.5-flash-image`
- **Purpose**: Generate background pattern image
- **Input**: Uses `image_prompt` from Step 1
- **Features**:
  - Specialized image generation model
  - Creates seamless tileable patterns
  - Only called when `themeType === 'image'`

### Why Two Steps?

The `gemini-2.5-flash-image` model doesn't support structured output (JSON mode). By separating concerns:
1. **Step 1** uses `flash-lite` for reliable JSON generation with schema validation
2. **Step 2** uses `flash-image` for high-quality image generation
3. Result: Best of both worlds - reliable data + great images

### Structured Output Benefits

The structured output in Step 1 provides:
- **Guaranteed JSON format**: No complex parsing or retry logic needed
- **Schema validation**: Enum constraints ensure valid font families, border radius, and box shadow values
- **Reduced retries**: From 5 attempts to 3, as JSON parsing is now reliable
- **Consistent responses**: All fields are validated against the defined schema
- **Image prompt generation**: Model creates optimal prompt for Step 2

### Error Handling

The service includes robust error handling and retry logic:
- Reduced retry attempts (3 instead of 5) due to structured output reliability
- Automatic retries for transient failures
- Graceful degradation when image generation fails
- Detailed error messages for debugging

### Security

- API keys are stored securely in Google Cloud Secret Manager
- All requests are validated and sanitized
- Rate limiting and abuse prevention measures are in place