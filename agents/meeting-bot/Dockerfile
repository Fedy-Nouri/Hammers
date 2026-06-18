FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN npx playwright install chromium --with-deps

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
