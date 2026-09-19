FROM golang:1.26-alpine AS build

WORKDIR /app
COPY go.mod go.sum ./
COPY cmd ./cmd
COPY internal ./internal
RUN go build -o /dashboard-lab-api ./cmd/api

FROM alpine:3.22
RUN addgroup -S app && adduser -S app -G app
USER app
COPY --from=build /dashboard-lab-api /dashboard-lab-api
EXPOSE 8080
ENTRYPOINT ["/dashboard-lab-api"]
