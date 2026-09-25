<?php
declare(strict_types=1);

require __DIR__ . '/../config/bootstrap.php';

// Used by hosting health checks, and handy for "waking up" a sleeping free-tier server.
try {
    Database::connection()->query('SELECT 1');
    Response::json(200, ['status' => 'ok', 'db' => 'up', 'time' => gmdate('c')]);
} catch (PDOException $e) {
    error_log('[askboard] health check DB failure: ' . $e->getMessage());
    Response::json(503, ['status' => 'degraded', 'db' => 'down', 'time' => gmdate('c')]);
}
