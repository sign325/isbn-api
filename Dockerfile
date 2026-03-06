FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 libx11-xcb1 \
    fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install patchright chromium
RUN npx patchright install chromium

COPY tsconfig.json ./
COPY src/ src/

EXPOSE 2137

CMD ["npx", "tsx", "src/index.ts"]
