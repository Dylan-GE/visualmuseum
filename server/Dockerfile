FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY personas.js index.js ./

ENV PORT=8787
EXPOSE 8787

CMD ["node", "index.js"]
