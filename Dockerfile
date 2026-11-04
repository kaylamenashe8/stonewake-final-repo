# Same pinned image as CI (D11). The tag MUST equal @playwright/test in package.json (scripts/version-check.sh).
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /work
ENV CI=true HOME=/root

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

CMD ["npx", "playwright", "test"]
