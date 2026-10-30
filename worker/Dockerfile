FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY worker ./worker
RUN chown -R pwuser:pwuser /app
USER pwuser
CMD ["node", "worker/worker.mjs"]
