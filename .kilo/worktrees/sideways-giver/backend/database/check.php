<?php
declare(strict_types=1);

/**
 * Quick "am I connected?" check:  php backend/database/check.php
 * Prints which database you reached and whether the deals table has data.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../config/bootstrap.php';

try {
    $pdo = Database::connection();
    $info = $pdo->query('SELECT current_database() AS db, current_user AS usr, version() AS v')->fetch();
    echo "Connected to database '{$info['db']}' as user '{$info['usr']}'.\n";
    echo strtok((string)$info['v'], ',') . "\n";

    $exists = $pdo->query("SELECT to_regclass('public.deals') IS NOT NULL")->fetchColumn();
    if (!$exists) {
        echo "Table 'deals' does not exist yet. Run: php backend/database/migrate.php --seed\n";
        exit(1);
    }
    $count = $pdo->query('SELECT count(*) FROM deals')->fetchColumn();
    echo "Table 'deals' found with {$count} rows.\n";
} catch (PDOException $e) {
    echo "Could not connect: " . $e->getMessage() . "\n";
    echo "Check DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD in backend/.env and that PostgreSQL is running.\n";
    exit(1);
}
