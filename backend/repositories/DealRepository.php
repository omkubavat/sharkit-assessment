<?php
declare(strict_types=1);

/**
 * Data access ONLY. The one place that contains SQL.
 * Knows nothing about HTTP or business rules. Always uses prepared statements.
 */
final class DealRepository
{
    // created_at is returned as ISO 8601 UTC ("2026-09-25T10:00:00Z") so every browser parses it.
    private const COLUMNS = "id, company_name, founder_name, sector, pitch, funding_type, amount_inr, equity_percent, "
        . "to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at";

    public function __construct(private readonly PDO $pdo)
    {
    }

    /** Newest first. @return list<array<string,mixed>> */
    public function findAll(?string $type, int $limit): array
    {
        $sql = 'SELECT ' . self::COLUMNS . ' FROM deals';
        if ($type !== null) {
            $sql .= ' WHERE funding_type = :type';
        }
        $sql .= ' ORDER BY created_at DESC, id DESC LIMIT :limit';

        $stmt = $this->pdo->prepare($sql);
        if ($type !== null) {
            $stmt->bindValue(':type', $type, PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return array_map([$this, 'hydrate'], $stmt->fetchAll());
    }

    /** @param array<string,mixed> $d already-validated data @return array<string,mixed> */
    public function insert(array $d): array
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO deals (company_name, founder_name, sector, pitch, funding_type, amount_inr, equity_percent)
             VALUES (:company_name, :founder_name, :sector, :pitch, :funding_type, :amount_inr, :equity_percent)
             RETURNING ' . self::COLUMNS
        );
        $stmt->bindValue(':company_name', $d['company_name'], PDO::PARAM_STR);
        $stmt->bindValue(':founder_name', $d['founder_name'], PDO::PARAM_STR);
        $stmt->bindValue(':sector', $d['sector'], PDO::PARAM_STR);
        $stmt->bindValue(':pitch', $d['pitch'], PDO::PARAM_STR);
        $stmt->bindValue(':funding_type', $d['funding_type'], PDO::PARAM_STR);
        $stmt->bindValue(':amount_inr', $d['amount_inr'], PDO::PARAM_INT);
        if ($d['equity_percent'] === null) {
            $stmt->bindValue(':equity_percent', null, PDO::PARAM_NULL);
        } else {
            $stmt->bindValue(':equity_percent', (string)$d['equity_percent'], PDO::PARAM_STR);
        }
        $stmt->execute();

        return $this->hydrate($stmt->fetch());
    }

    /** Cast DB values to the types the API promises (NUMERIC comes back as a string). */
    private function hydrate(array $row): array
    {
        return [
            'id'             => (int)$row['id'],
            'company_name'   => $row['company_name'],
            'founder_name'   => $row['founder_name'],
            'sector'         => $row['sector'],
            'pitch'          => $row['pitch'],
            'funding_type'   => $row['funding_type'],
            'amount_inr'     => (int)$row['amount_inr'],
            'equity_percent' => $row['equity_percent'] === null ? null : (float)$row['equity_percent'],
            'created_at'     => $row['created_at'],
        ];
    }
}
