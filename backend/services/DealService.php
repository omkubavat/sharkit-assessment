<?php
declare(strict_types=1);

/**
 * Business rules ONLY: what a valid deal is, and what listing means.
 * Knows nothing about HTTP (no $_GET, no status codes) or SQL.
 * The client mirrors these limits for instant feedback; THIS is the authority.
 */
final class DealService
{
    public const SECTORS = ['Fintech', 'HealthTech', 'AgriTech', 'EdTech', 'SaaS', 'D2C', 'Clean Energy', 'Logistics', 'Other'];
    public const TYPES = ['Equity', 'Loan', 'Grant'];
    public const TEXT_MAX = 60;
    public const PITCH_MAX = 140;
    public const AMOUNT_MIN = 10000;          // Rs 10,000
    public const AMOUNT_MAX = 1000000000;     // Rs 100 crore
    public const LIST_LIMIT = 50;             // newest 50; pagination is a deliberate non-goal

    public function __construct(private readonly DealRepository $deals)
    {
    }

    /** @throws InvalidArgumentException for an unknown type filter @return list<array<string,mixed>> */
    public function listDeals(?string $type): array
    {
        $canonical = null;
        if ($type !== null && $type !== '' && strcasecmp($type, 'All') !== 0) {
            $canonical = $this->canonicalType($type)
                ?? throw new InvalidArgumentException('type must be one of: All, Equity, Loan, Grant.');
        }
        return $this->deals->findAll($canonical, self::LIST_LIMIT);
    }

    /** @param array<string,mixed> $input @throws ValidationException @return array<string,mixed> */
    public function createDeal(array $input): array
    {
        $errors = [];

        $company = $this->text($input, 'company_name', self::TEXT_MAX, 'Enter your company name.', $errors);
        $founder = $this->text($input, 'founder_name', self::TEXT_MAX, "Enter the founder's name.", $errors);
        $pitch   = $this->text($input, 'pitch', self::PITCH_MAX, 'Write a one-line pitch.', $errors);

        $sector = $input['sector'] ?? null;
        if (!is_string($sector) || !in_array($sector, self::SECTORS, true)) {
            $errors['sector'] = 'Choose a sector from the list.';
        }

        $type = is_string($input['funding_type'] ?? null) ? $this->canonicalType($input['funding_type']) : null;
        if ($type === null) {
            $errors['funding_type'] = 'Choose Equity, Loan or Grant.';
        }

        $amount = $input['amount_inr'] ?? null;
        if (is_string($amount) && preg_match('/^\d{1,12}$/', $amount) === 1) {
            $amount = (int)$amount;
        }
        if (!is_int($amount)) {
            $errors['amount_inr'] = 'Enter the amount as a whole number of rupees.';
        } elseif ($amount < self::AMOUNT_MIN || $amount > self::AMOUNT_MAX) {
            $errors['amount_inr'] = sprintf('Amount must be between Rs %s and Rs 100 crore.', number_format(self::AMOUNT_MIN));
        }

        // Equity % is required for Equity and must be absent for Loan/Grant.
        $equity = null;
        if ($type !== null) {
            $raw = $input['equity_percent'] ?? null;
            $provided = $raw !== null && $raw !== '';
            if ($type === 'Equity') {
                if (!(is_int($raw) || is_float($raw) || (is_string($raw) && is_numeric($raw)))) {
                    $errors['equity_percent'] = 'Enter the equity you are offering, like 8 or 7.5.';
                } else {
                    $f = (float)$raw;
                    if ($f <= 0 || $f >= 100) {
                        $errors['equity_percent'] = 'Equity must be more than 0% and less than 100%.';
                    } elseif (abs($f * 100 - round($f * 100)) > 1e-6) {
                        $errors['equity_percent'] = 'Use at most two decimal places.';
                    } else {
                        $equity = round($f, 2);
                    }
                }
            } elseif ($provided) {
                $errors['equity_percent'] = 'Equity percentage only applies to Equity asks.';
            }
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        return $this->deals->insert([
            'company_name'   => $company,
            'founder_name'   => $founder,
            'sector'         => $sector,
            'pitch'          => $pitch,
            'funding_type'   => $type,
            'amount_inr'     => $amount,
            'equity_percent' => $equity,
        ]);
    }

    private function canonicalType(string $value): ?string
    {
        foreach (self::TYPES as $t) {
            if (strcasecmp($t, $value) === 0) {
                return $t;
            }
        }
        return null;
    }

    /** Length in characters (not bytes), without needing the optional mbstring extension. */
    private function charLength(string $value): int
    {
        return (int)preg_match_all('/./su', $value);
    }

    /** @param array<string,mixed> $in @param array<string,string> $errors */
    private function text(array $in, string $key, int $max, string $requiredMsg, array &$errors): ?string
    {
        $v = $in[$key] ?? null;
        if (!is_string($v) || trim($v) === '') {
            $errors[$key] = $requiredMsg;
            return null;
        }
        $v = trim($v);
        if (preg_match('/[\x00-\x1F\x7F]/u', $v) === 1) {
            $errors[$key] = 'Remove line breaks and control characters.';
            return null;
        }
        if ($this->charLength($v) > $max) {
            $errors[$key] = "Keep it to {$max} characters or fewer.";
            return null;
        }
        return $v;
    }
}
