<?php
declare(strict_types=1);

/** Thrown by the service when input breaks a rule. Carries one message per bad field. */
final class ValidationException extends RuntimeException
{
    /** @param array<string,string> $fields */
    public function __construct(public readonly array $fields)
    {
        parent::__construct('Validation failed');
    }
}
