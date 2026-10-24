FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production STUDIO_DEPLOY_TARGET=railway STUDIO_DATA_DIR=/data
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod=false
COPY . .
RUN pnpm run build:railway
EXPOSE 3000
CMD ["node", "server/start-railway.mjs"]
