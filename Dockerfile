FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    libglib2.0-0 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium

# ✅ Add dummy env vars so build doesn't fail
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
ENV NEXT_PUBLIC_SITE_URL=https://placeholder.com

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build 2>&1

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "start"]