#!/bin/sh
# Gives the local app a public address so Minds (on Hello Minds' servers) can reach it.
# With NGROK_DOMAIN set in .env.local, the address is permanent; set INGEST_URL to it once.
# Without it, a free Cloudflare quick tunnel is used: its address changes on every start
# and it can drop, so INGEST_URL has to be updated each time.
[ -f .env.local ] && NGROK_DOMAIN=$(grep '^NGROK_DOMAIN=' .env.local | cut -d= -f2-)
if [ -n "$NGROK_DOMAIN" ]; then
  command -v ngrok >/dev/null || { echo "Install ngrok first: brew install ngrok"; exit 1; }
  exec ngrok http --url="$NGROK_DOMAIN" 3000 --log=stdout
fi
exec cloudflared tunnel --no-autoupdate --url http://localhost:3000
