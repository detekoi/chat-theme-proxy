FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . ./

# Set environment variables
ENV PORT=8091
ENV NODE_ENV=production

CMD [ "npm", "start" ]