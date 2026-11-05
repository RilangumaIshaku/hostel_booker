FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY worker ./worker
# The hostel catalogue is shared with the dashboard, so the worker carries it too.
COPY lib ./lib
RUN chown -R pwuser:pwuser /app
USER pwuser
CMD ["node", "worker/worker.mjs"]
