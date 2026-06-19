# Railway backend image for the Go API.
# This avoids Nixpacks misdetecting the repository as a Node/npm project.

FROM golang:1.22-bookworm AS builder

WORKDIR /src/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app
COPY --from=builder /out/api /app/api

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/app/api"]
