FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . ./

# Container will use the PORT env var from Cloud Run
ENV PORT=8091

CMD [ "npm", "start" ]