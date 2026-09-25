<?php
declare(strict_types=1);

/** Tiny JSON response helper. Every method ends the request. */
final class Response
{
    /** @param array<string,mixed> $payload @param array<string,string> $headers */
    public static function json(int $status, array $payload, array $headers = []): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
        foreach ($headers as $name => $value) {
            header("{$name}: {$value}");
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit;
    }

    /** @param array<string,mixed> $extra @param array<string,string> $headers */
    public static function error(int $status, string $code, string $message, array $extra = [], array $headers = []): never
    {
        self::json($status, ['error' => $code, 'message' => $message] + $extra, $headers);
    }
}
