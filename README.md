# Twitch Chat Theme Generator Proxy

A simple Express server that acts as a proxy for the Gemini API, generating Twitch chat themes based on user prompts.

## Features

- Secure server-side API key handling for Gemini API
- Theme generation based on text prompts
- Expanded font selection including custom fonts
- Test interface for trying the theme generator

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