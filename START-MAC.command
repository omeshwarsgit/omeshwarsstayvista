#!/bin/bash
# ==============================================================================
# StayVista Rate Parity Engine - macOS Auto-Launcher
# Zero-Prerequisite Launcher for non-technical users
# ==============================================================================

# Ensure working directory is the folder where this script resides (handles spaces safely)
cd "$(cd "$(dirname "$0")" && pwd)"

echo "================================================================"
echo "        StayVista Rate Parity Engine - Auto Launcher            "
echo "================================================================"
echo ""

# Helper to test if port 3000 is currently listening
is_port_in_use() {
  lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1 || nc -z 127.0.0.1 3000 >/dev/null 2>&1 || curl -s -o /dev/null http://127.0.0.1:3000 >/dev/null 2>&1
}

# Safeguard: Check if the server is already active
if is_port_in_use; then
  echo " [INFO] StayVista Rate Parity Engine is already active on http://localhost:3000."
  echo " [INFO] Opening your default web browser..."
  open "http://localhost:3000"
  sleep 2
  exit 0
fi

# [1/4] Check & Bootstrap Node.js Runtime
echo "[1/4] Checking Node.js runtime..."

NODE_BIN=""
if [ -x ".runtime/node/bin/node" ]; then
  export PATH="$PWD/.runtime/node/bin:$PATH"
  NODE_BIN="$PWD/.runtime/node/bin/node"
  echo "      Using portable local Node.js ($("$NODE_BIN" -v))."
elif command -v node >/dev/null 2>&1; then
  NODE_VER_NUM=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER_NUM" -ge 18 ] 2>/dev/null; then
    NODE_BIN="$(command -v node)"
    echo "      Found system Node.js ($("$NODE_BIN" -v))."
  fi
fi

# If Node.js >= 18 is not found, download official portable standalone package
if [ -z "$NODE_BIN" ]; then
  echo "      Node.js >= v18 not found on your system."
  echo "      Downloading portable standalone Node.js (v20.18.3 LTS)..."
  echo "      (No administrator or sudo rights required - installs locally into .runtime)"

  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    NODE_DIST="darwin-arm64"
  else
    NODE_DIST="darwin-x64"
  fi

  NODE_URL="https://nodejs.org/dist/v20.18.3/node-v20.18.3-${NODE_DIST}.tar.gz"
  mkdir -p .runtime/temp .runtime/node

  if command -v curl >/dev/null 2>&1; then
    curl -fSL --progress-bar "$NODE_URL" -o .runtime/temp/node.tar.gz
  else
    echo " [ERROR] curl is required to download runtime."
    exit 1
  fi

  echo "      Extracting Node.js package..."
  tar -xzf .runtime/temp/node.tar.gz --strip-components=1 -C .runtime/node
  rm -rf .runtime/temp

  export PATH="$PWD/.runtime/node/bin:$PATH"
  NODE_BIN="$PWD/.runtime/node/bin/node"

  if [ ! -x "$NODE_BIN" ]; then
    echo " [ERROR] Failed to bootstrap Node.js. Please check your internet connection."
    exit 1
  fi
  echo "      Successfully configured local Node.js ($("$NODE_BIN" -v))."
fi

# [2/4] Check & Install Application Dependencies
echo "[2/4] Checking dependencies..."
if [ ! -d "node_modules" ]; then
  echo "      Dependencies not found. Installing packages (npm install)..."
  echo "      (This only happens on first run and takes about 1-2 minutes)"
  npm install
  if [ $? -ne 0 ]; then
    echo " [ERROR] Failed to install dependencies. Please check network connectivity."
    exit 1
  fi
else
  echo "      Dependencies found."
fi

# [3/4] Setup Database & Playwright Browser Engine
echo "[3/4] Preparing database and browser engines..."

# Ensure Prisma client engines are generated
npx prisma generate >/dev/null 2>&1

# Initialize SQLite database if not present
if [ ! -f "prisma/dev.db" ]; then
  echo "      Initializing local database schema..."
  npx prisma db push --skip-generate >/dev/null 2>&1
fi

# Ensure Playwright Chromium browser binary is available
echo "      Checking Playwright Chromium browser..."
npx playwright install chromium

# [4/4] Launch Application & Auto-Open Web Browser
echo ""
echo "[4/4] Starting StayVista Rate Parity Engine..."
echo "      Server starting on http://localhost:3000"
echo "      Opening browser automatically when ready..."
echo ""
echo "----------------------------------------------------------------"
echo " TIP: Keep this window open while using the application."
echo "      To stop the engine, press Ctrl+C or close this window."
echo "----------------------------------------------------------------"
echo ""

# Background watcher to detect when the server is ready and launch the browser
(
  for i in $(seq 1 45); do
    sleep 1
    if is_port_in_use; then
      open "http://localhost:3000"
      break
    fi
  done
) &

# Run Next.js server
npm run dev
