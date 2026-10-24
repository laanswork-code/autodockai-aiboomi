# The app for Railway: build the twin and serve it, the Jev API and the
# multiplayer game from one Node 24 process (server/prod.ts).
# Node 24, not 25: uWebSockets.js ships binaries for even Node versions only, built
# against glibc 2.38+, hence Debian trixie.
FROM node:24-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  # the lockfile records uWebSockets.js as git+ssh; fetch it over https instead
  && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
WORKDIR /app/ksum-3d
COPY ksum-3d/package.json ksum-3d/package-lock.json ./
RUN npm ci
COPY ksum-3d/ ./
# the How it works page imports the pitch film from docs/demo
COPY docs/demo/pitch-film.mp4 docs/demo/pitch-film-poster.jpg /app/docs/demo/
RUN npm run build
ENV NODE_ENV=production
CMD ["node", "server/prod.ts"]
