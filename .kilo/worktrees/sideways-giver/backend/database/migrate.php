<?php
declare(strict_types=1);

/**
 * Apply the schema (and optionally the seed data) to whatever database the environment points at.
 *   php backend/database/migrate.php            -> schema only
 *   php backend/database/migrate.php --seed     -> schema + demo data
 * Works locally (.env) and against Railway (set DATABASE_URL first).
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../config/bootstrap.php';

try {
    $pdo = Database::connection();

    $pdo->exec((string)file_get_contents(__DIR__ . '/schema.sql'));
    echo "Schema applied.\n";

    if (in_array('--seed', $argv ?? [], true)) {
        $pdo->exec((string)file_get_contents(__DIR__ . '/seed.sql'));
        $count = $pdo->query('SELECT count(*) FROM deals')->fetchColumn();
        echo "Seed applied (only inserts into an empty table). Deals in database: {$count}\n";
    }
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    echo "Run 'php backend/database/check.php' to diagnose the connection.\n";
    exit(1);
}
