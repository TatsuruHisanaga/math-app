# Stage 1: Build the Next.js application
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Runtime environment with TeX Live
FROM node:20-slim AS runner
WORKDIR /app

# Install LuaLaTeX and necessary Japanese TeX packages
# Using a slim base and adding only needed texlive components to save space
RUN apt-get update && apt-get install -y \
    texlive-luatex \
    texlive-lang-japanese \
    texlive-latex-extra \
    texlive-fonts-recommended \
    fonts-ipaexfont \
    && kanji-config-updmap-sys haranoaji \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080

# Copy build artifacts and data
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/data ./data
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080

CMD ["npm", "start"]
