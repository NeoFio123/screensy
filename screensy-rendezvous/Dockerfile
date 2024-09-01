FROM node:22.6-alpine3.19 AS builder

WORKDIR /home/node/app

COPY tsconfig.json ./
COPY server.ts ./

COPY package.json ./
COPY package-lock.json ./

RUN npm install --only=development
RUN npx tsc

FROM node:22.6-alpine3.19

COPY --from=builder /home/node/app/server.js ./
COPY --from=builder /home/node/app/server.js.map ./
COPY --from=builder /home/node/app/server.ts ./

COPY package.json ./
COPY package-lock.json ./

RUN npm install --only=production

USER node

CMD ["npm", "start"]
