ARG NODE_IMAGE=node@sha256:b74031e546d7f4faf561d797ac1b76beccac856a042815ca77db4fd047581605

FROM ${NODE_IMAGE} AS base

WORKDIR /app

ENV NODE_ENV="production" \
    PUPPETEER_CACHE_DIR=/app/.cache \
    DISPLAY=:10 \
    PATH="/usr/bin:/app/selenium/driver:${PATH}" \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/bin/chromium-browser

LABEL org.opencontainers.image.source="https://github.com/omni-wellness/steel-browser"

RUN apk upgrade --no-cache

# Stage 1: Build UI
FROM ${NODE_IMAGE} AS ui-build

WORKDIR /app

# Copy root workspace files for UI build
COPY --link package.json package-lock.json ./
COPY --link ui/ ./ui/

# Install UI dependencies and build with correct base path
RUN npm ci --include=dev -w ui --ignore-scripts
RUN VITE_API_URL="" VITE_WS_URL="" npm run build -w ui -- --base=/ui

# Stage 2: Build API
FROM base AS api-build

RUN apk add --no-cache \
    build-base \
    linux-headers \
    pkgconf \
    python3

# Copy root workspace files for API build
COPY --link package.json package-lock.json ./

# Remove or override the prepare script to avoid husky in Docker
RUN npm pkg set scripts.prepare="echo skip husky"

COPY --link api/ ./api/

# Install dependencies for API
RUN npm ci --include=dev --workspace=api

# Install dependencies for recorder extension separately
RUN cd api/extensions/recorder && npm ci --include=dev && cd -

# Build the API package
RUN npm run build -w api

# Build the recorder extension
RUN cd api/extensions/recorder && \
    npm run build && \
    cd -

# Prune dev dependencies
RUN npm prune --omit=dev -w api
RUN cd api/extensions/recorder && npm prune --omit=dev && cd -

# Stage 3: Production
FROM base AS production

RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    curl \
    dbus \
    font-freefont \
    font-noto-cjk \
    font-noto-thai \
    gcompat \
    nginx \
    procps \
    tini \
    unzip \
    wget \
    xvfb

RUN mkdir -p /files

# Copy the built API from api-build stage
COPY --from=api-build /app /app

# Copy the built UI from ui-build stage into the API container
COPY --from=ui-build /app/ui/dist /app/ui/dist

# Copy entrypoint script
COPY --chmod=755 api/entrypoint.sh /app/api/entrypoint.sh

EXPOSE 3000 9223

ENV HOST_IP=localhost \
    DBUS_SESSION_BUS_ADDRESS=autolaunch:

ENTRYPOINT ["/sbin/tini", "-g", "--", "/app/api/entrypoint.sh"]
