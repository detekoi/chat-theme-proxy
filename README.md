# Twitch Chat Theme Generator Proxy

An Express server that acts as a proxy for the Gemini API. It generates Twitch chat themes for the [Twitch Chat Overlay](https://github.com/detekoi/wildcat-home) based on user prompts.

## Features

- Secure server-side API key handling for the Gemini API
- Theme generation from text prompts
- Font selection with custom Google Fonts
- Web interface for testing theme generation
- AI-generated background pattern images that match the theme
- Dedicated rate limiting on generation endpoints

## Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory. Add your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   RUNWARE_API_KEY=your_runware_api_key_here
   ```

## Running the Server

If you develop locally with auto-restart:
```bash
npm run dev
```

If you run in production mode:
```bash
npm start
```

The server starts on port 8091 by default. If you want to change the port, set the `PORT` environment variable.

## Testing

If you want to access the test interface, open `http://localhost:8091` in your browser after you start the server.

## API Endpoints

- `GET /` - Test interface in development or health check message in production
- `GET /health` - Health check status
- `POST /api/generate-theme` - Generate a chat theme from a prompt (rate limited to 30 requests per 15 minutes per IP)
- `GET /api/fonts` - Get available Google Fonts

## Docker

To build the Docker image, run:
```bash
docker build -t chat-theme-proxy .
```

To run the container:
```bash
docker run -p 8091:8091 -e GEMINI_API_KEY=your_gemini_api_key_here -e RUNWARE_API_KEY=your_runware_api_key_here chat-theme-proxy
```

## Google Cloud Platform Deployment

### Manual Deployment via Script

1. Install and set up the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).

2. Set your API keys as environment variables:
   ```bash
   export GEMINI_API_KEY=your_gemini_api_key_here
   export RUNWARE_API_KEY=your_runware_api_key_here
   ```

3. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

The script performs four tasks:
- Validates environment variables.
- Configures Docker authentication for GCP.
- Builds and pushes the container image.
- Deploys the service to Cloud Run with configuration settings.

### GitHub Actions Deployment

If you use automated deployment with GitHub Actions, set these repository secrets:

1. Go to Settings → Secrets and variables → Actions in your repository.
2. Add these four secrets:
   - `GCP_PROJECT_ID`: Your Google Cloud Project ID
   - `GCP_SA_KEY`: Your Google Cloud Service Account key JSON
   - `GEMINI_API_KEY`: Your Gemini API key
   - `RUNWARE_API_KEY`: Your Runware API key

The GitHub workflow performs four actions when you push to the main branch:
- Builds and pushes the Docker image to Google Artifact Registry.
- Deploys the service to Cloud Run.
- Configures environment variables and secrets.
- Sets up public access for the service.

### Required GCP Setup

Before you deploy, make sure that you complete these steps:

1. Create a Google Cloud Project.
2. Enable these APIs:
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API
3. Create a Service Account with these four roles:
   - Cloud Run Admin
   - Cloud Build Service Account
   - Service Account User
   - Artifact Registry Writer
4. Download the Service Account key JSON file.

## Deployment and API Usage

Deploy the service to Google Cloud Run or run it locally.

### Rate Limiting

The API rate limits theme generation (`POST /api/generate-theme`) to 30 requests per 15 minutes per IP address. If a client exceeds this limit, the server returns an HTTP 429 status code.

### API Usage Examples

If you want to generate a theme with a background image, send a request to your server endpoint:
```bash
curl -X POST http://localhost:8091/api/generate-theme \
  -H "Content-Type: application/json" \
  -d '{"prompt":"cozy cabin","themeType":"image","attempt":0}'
```

If you want to generate a color-only theme without a background image:
```bash
curl -X POST http://localhost:8091/api/generate-theme \
  -H "Content-Type: application/json" \
  -d '{"prompt":"cyberpunk neon","themeType":"color","attempt":0}'
```

## Background Image Implementation

### Overview

The service uses a two-step process to create background patterns. Step 1 calls the Gemini API to generate the theme configuration. Step 2 calls the Runware API to generate a matching background pattern image.

### Technical Details

#### Image Format and Storage

- The API returns images as base64-encoded PNG data.
- The API includes image data in `backgroundImage.data` and `backgroundImage.mimeType`.
- You can use the data in CSS as `data:image/png;base64,{data}`.

#### CSS Implementation

The [Chat Overlay](https://github.com/detekoi/wildcat-home) application displays background patterns with CSS pseudo-elements.

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

The API returns a JSON object with this structure:

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

The default pattern tile size is 320px. Change the `background-size` CSS property if you want a different pattern size.

#### Request Parameters

- `prompt`: String that describes the theme (for example, "cozy cabin")
- `themeType`: "image" for themes with background patterns, or "color" for color-only themes
- `attempt`: Number of the retry attempt (0 for the first request)

#### Disabling Background Images

If you want color-only themes without background images, set `themeType: "color"` in your request body.

### Troubleshooting

#### Background Image Does Not Appear

If the background image does not appear, follow these four steps:
1. Open the browser console and check for network errors.
2. Verify that the CSS variable contains the image data URL.
3. Make sure that the data URL contains a valid MIME type.
4. Reduce the opacity of the background color if the pattern is hidden.

#### Performance Issues

If request speed decreases:
1. Set `themeType: "color"` to generate themes without background images.
2. Store generated themes on the client side to avoid repeated API requests.

## Implementation Notes

### Two-Step Generation Process

The service combines two APIs:

#### Step 1: Theme Data Generation (`gemini-flash-lite-latest`)
- **Model**: `gemini-flash-lite-latest`
- **Function**: Generates theme JSON data and an image prompt
- **Features**:
  - Uses structured output with JSON schema validation
  - Sets response MIME type to `application/json`
  - Returns a consistent response format
  - Creates the `image_prompt` field for Step 2

#### Step 2: Image Generation (Runware FLUX.1 Schnell)
- **Model**: `runware:100@1` (FLUX.1 Schnell)
- **Function**: Generates the background pattern image
- **Input**: Uses the `image_prompt` created in Step 1
- **Features**:
  - Generates seamless tileable patterns
  - Returns a 512x512 PNG image in base64 format
  - Runs only when `themeType === 'image'`

### Why Two Steps

The service divides theme creation into two steps:
1. Step 1 uses Gemini to create structured JSON theme data with schema validation.
2. Step 2 uses Runware FLUX.1 Schnell to create background images.
3. The process delivers reliable theme structure and fast image generation.

### Structured Output Benefits

Structured output in Step 1 provides these four benefits:
- Guaranteed JSON format without custom parsing.
- Schema validation for font families, border radius, and box shadow options.
- Reduced retry attempts (3 attempts instead of 5).
- Clear image prompts generated for Step 2.

### Error Handling

The service includes retry logic and error reporting:
- Retries transient API failures automatically (up to 3 attempts).
- Returns theme color data if image generation fails.
- Sends descriptive error messages for debugging.

### Security and Rate Limiting

- API keys stay in Google Cloud Secret Manager.
- Route-level rate limiting caps theme generation (`POST /api/generate-theme`) to 30 requests per 15 minutes per IP address.
- All requests undergo validation and sanitization.