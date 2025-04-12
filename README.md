# Twitch Chat Theme Generator Proxy

A simple Express server that acts as a proxy for the Gemini API, generating Twitch chat themes based on user prompts.

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

## Background Image Implementation

### Overview

The theme generator uses Gemini 2.0 Flash's image generation capabilities to create subtle tiled background patterns that match the theme generated from the user's prompt. These patterns are applied to both the chat window and popup messages.

### Technical Details

#### Image Format and Storage

- Images are returned from Gemini as base64-encoded data URLs
- These URLs are stored directly in the theme configuration
- The data URLs are applied using CSS variables: `--chat-bg-image: url('data:image/...')`

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

#### Theme Data Structure

The theme data JSON now includes an additional field:

```json
{
  "theme_name": "Example Theme",
  "background_color": "rgba(12, 20, 69, 0.85)",
  "border_color": "#ff6bcb",
  "text_color": "#efeff1",
  "username_color": "#9147ff",
  "font_family": "Tektur",
  "border_radius": "8px",
  "box_shadow": "soft",
  "description": "A short description of the theme",
  "background_image": "data:image/png;base64,..." // New field
}
```

### Customization

#### Image Size

The default tile size is set to 320px. This can be adjusted by changing the `background-size` property in the CSS.

#### Disabling Background Images

If you want to disable background images for a specific theme, you can:

1. Set `theme.backgroundImage = null` in the theme object
2. Remove the CSS variable with `document.documentElement.style.removeProperty('--chat-bg-image')`

### Troubleshooting

#### Image Not Appearing

If the background image doesn't appear:

1. Check the browser console for errors
2. Verify that the CSS variable is being set correctly
3. Ensure the data URL is valid and contains the correct MIME type
4. Try adjusting the opacity of the background color to make the pattern more visible

#### Performance Issues

If you experience performance issues with background images:

1. You can disable background images entirely using the provided toggle option for low-powered devices

### Future Enhancements

Potential future improvements to this feature:

1. Implement image caching to reduce data usage
2. Add more controls for adjusting the background pattern (size, etc.)
3. Support for different tiling modes (e.g., mirror, rotate)