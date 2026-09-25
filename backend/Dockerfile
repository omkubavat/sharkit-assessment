# Build context is the backend folder (rootDirectory=/backend). PHP's built-in server + a router that only exposes /api/**.
FROM php:8.3-cli-alpine

RUN apk add --no-cache postgresql-dev \
    && docker-php-ext-install pdo_pgsql

WORKDIR /app
COPY . /app/backend/

# Railway injects $PORT. Several workers so one slow request doesn't block the rest.
ENV PHP_CLI_SERVER_WORKERS=4
EXPOSE 8000
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8000} -t /app/backend /app/backend/router.php"]
