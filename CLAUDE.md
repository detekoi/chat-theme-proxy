# Chat Theme Proxy - Claude Guidelines

## Commands
- `npm start` - Start the server locally (runs on port 8091 by default)
- `docker build -t chat-theme-proxy .` - Build Docker image
- `docker run -p 8091:8091 -e GEMINI_API_KEY=your-key chat-theme-proxy` - Run in Docker

## Environment Variables
- `PORT` - Server port (default: 8091)
- `GEMINI_API_KEY` - Required API key for Gemini

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