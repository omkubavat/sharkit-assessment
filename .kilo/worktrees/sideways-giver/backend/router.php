<?php
declare(strict_types=1);

/**
 * Router for PHP's built-in server (local + Railway):
 *   php -S localhost:8000 -t backend backend/router.php
 * Without it, `-t backend` would serve backend/.env and the SQL files as plain text.
 */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (preg_match('#^/api/[A-Za-z0-9_/]+\.php$#', $path) === 1) {
    $file = __DIR__ . $path;
    if (is_file($file)) {
        require $file;
        return true;
    }
}

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['error' => 'not_found', 'message' => 'No such endpoint.']);
return true;
