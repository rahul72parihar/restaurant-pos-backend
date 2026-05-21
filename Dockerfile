FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["node", "src/index.js"]
