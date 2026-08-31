FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /data
ENV DB_PATH=/data/signwall.db
EXPOSE 3000
CMD ["node", "server.js"]
