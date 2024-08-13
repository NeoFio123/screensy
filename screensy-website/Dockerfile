FROM node:22.6-alpine3.19 AS typescript_builder

WORKDIR /home/node/app

COPY tsconfig.json ./
COPY screensy.ts ./

RUN npm install typescript@5.5.4 -g
RUN tsc



FROM golang:1.22.6 as go_builder

WORKDIR /go/src/app

COPY main.go ./
COPY go.mod ./
COPY go.sum ./

# Install the dependencies for the project
RUN go mod download

RUN CGO_ENABLED=0 GOOS=linux go build -o screensy-website .



FROM alpine:3.19

COPY --from=typescript_builder /home/node/app/screensy.js ./
COPY --from=typescript_builder /home/node/app/screensy.js.map ./
COPY --from=typescript_builder /home/node/app/screensy.ts ./

COPY --from=go_builder /go/src/app/screensy-website ./

COPY translations/ ./translations

COPY styles.css ./

EXPOSE 8080

CMD ["./screensy-website"]
