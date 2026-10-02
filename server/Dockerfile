FROM node:24-alpine

WORKDIR /app

COPY server/package*.json ./

RUN npm install --omit=dev

COPY server/ ./

EXPOSE 5000

CMD ["npm", "start"]