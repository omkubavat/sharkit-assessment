<?php
declare(strict_types=1);

/**
 * CORS: only origins listed in ALLOWED_ORIGINS (comma-separated) may call the API from a browser.
 * The browser sends a preflight OPTIONS request first for JSON POSTs; we answer it here.
 */
function applyCors(): void
{
    $origin  = rtrim($_SERVER['HTTP_ORIGIN'] ?? '', '/');
    $allowed = array_map(
        static fn (string $o): string => rtrim(trim($o), '/'),
        explode(',', env('ALLOWED_ORIGINS', 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080') ?? '')
    );

    header('Vary: Origin');

    $wildcard = in_array('*', $allowed, true);
    // Local development convenience: with APP_DEBUG=1, any http://localhost or http://127.0.0.1
    // port is accepted, so a different dev-server port never causes a confusing CORS failure.
    $localDev = env('APP_DEBUG', '0') === '1'
        && preg_match('#^http://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin) === 1;

    $ok = $origin !== '' && ($wildcard || $localDev || in_array($origin, $allowed, true));

    if ($ok) {
        header('Access-Control-Allow-Origin: ' . ($wildcard ? '*' : $origin));
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
    }

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code($ok ? 204 : 403);
        exit;
    }
}