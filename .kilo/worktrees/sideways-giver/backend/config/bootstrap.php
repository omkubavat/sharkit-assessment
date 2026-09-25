<?php
declare(strict_types=1);

/**
 * bootstrap.php — loaded first by every endpoint.
 * Sets up: autoloading, .env, error handling, CORS, and the object wiring.
 */

define('BACKEND_ROOT', dirname(__DIR__));

// Autoload: a class named Foo lives at <layer>/Foo.php
spl_autoload_register(static function (string $class): void {
    foreach (['core', 'controllers', 'services', 'repositories'] as $dir) {
        $file = BACKEND_ROOT . "/{$dir}/{$class}.php";
        if (is_file($file)) {
            require $file;
            return;
        }
    }
});

/** Load KEY=VALUE lines from backend/.env (local dev). Real environment variables always win. */
function loadDotEnv(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        if (getenv($key) === false) {
            putenv($key . '=' . trim($value, " \t\"'"));
        }
    }
}

function env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    return ($value === false || $value === '') ? $default : $value;
}

loadDotEnv(BACKEND_ROOT . '/.env');

// Never print errors to the client; log them and return a clean JSON 500 instead.
ini_set('display_errors', '0');
error_reporting(E_ALL);

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity) || in_array($severity, [E_DEPRECATED, E_USER_DEPRECATED], true)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(static function (Throwable $e): void {
    error_log(sprintf('[askboard] %s: %s in %s:%d', get_class($e), $e->getMessage(), $e->getFile(), $e->getLine()));
    $debug = env('APP_DEBUG', '0') === '1';
    Response::error(500, 'server_error', $debug ? $e->getMessage() : 'Something went wrong on our side. Try again in a moment.');
});

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/cors.php';

applyCors(); // also answers OPTIONS preflight and stops there

/** Composition root: the only place that knows how the layers are wired together. */
function dealController(): DealController
{
    return new DealController(new DealService(new DealRepository(Database::connection())));
}
