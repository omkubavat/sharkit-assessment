<?php
declare(strict_types=1);

/**
 * One lazily-created PDO connection per request.
 * Railway provides DATABASE_URL; locally we use DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS.
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        [$host, $port, $name, $user, $pass] = self::params();
        $sslmode = env('DB_SSLMODE', 'prefer');
        $dsn = "pgsql:host={$host};port={$port};dbname={$name};sslmode={$sslmode}";

        self::$pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false, // real prepared statements
            PDO::ATTR_TIMEOUT            => 5,
        ]);

        return self::$pdo;
    }

    /** @return array{0:string,1:string,2:string,3:string,4:string} */
    private static function params(): array
    {
        $url = env('DATABASE_URL');
        if ($url !== null) {
            $p = parse_url($url);
            if ($p === false || !isset($p['host'], $p['path'])) {
                throw new RuntimeException('DATABASE_URL is not a valid connection URL.');
            }
            return [
                $p['host'],
                (string)($p['port'] ?? 5432),
                ltrim($p['path'], '/'),
                rawurldecode($p['user'] ?? ''),
                rawurldecode($p['pass'] ?? ''),
            ];
        }

        return [
            env('DB_HOST', 'localhost'),
            env('DB_PORT', '5432'),
            env('DB_NAME', 'sharkit'),
            env('DB_USER', 'postgres'),
            env('DB_PASSWORD', env('DB_PASS', '')), // accepts DB_PASSWORD (preferred) or DB_PASS
        ];
    }
}
