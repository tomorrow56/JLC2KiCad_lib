# ─────────────────────────────────────────────
# Stage 1: Build frontend + bundle server
# ─────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.4.1

# Copy dependency manifests first for layer caching
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build (Vite frontend + esbuild server bundle)
RUN pnpm build

# ─────────────────────────────────────────────
# Stage 2: Production runtime
# ─────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# ── Python 3 + pip + JLC2KiCadLib dependencies ──────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        git \
    && rm -rf /var/lib/apt/lists/*

# Create a dedicated venv so pip installs don't conflict with system packages
RUN python3 -m venv /opt/jlcvenv

# Install JLC2KiCadLib and its dependencies inside the venv
# KicadModTree is a required dependency of JLC2KiCadLib
RUN /opt/jlcvenv/bin/pip install --no-cache-dir \
        JLC2KiCadLib \
        requests

# ── Node.js runtime dependencies ────────────────────────────────────────────
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN npm install -g pnpm@10.4.1 && pnpm install --frozen-lockfile --prod

# ── Copy built artifacts ─────────────────────────────────────────────────────
COPY --from=builder /app/dist ./dist
# Worker script must be present alongside the server bundle
COPY server/convert_worker.py ./dist/convert_worker.py

# ── Runtime config ────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PYTHON_BIN=/opt/jlcvenv/bin/python3

EXPOSE 3000

CMD ["node", "dist/index.js"]
