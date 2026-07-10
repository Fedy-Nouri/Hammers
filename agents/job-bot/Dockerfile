FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npx playwright install chromium --with-deps

COPY . .
RUN npm run build

EXPOSE 3002
CMD ["node", "dist/index.js"]
