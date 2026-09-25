-- AskBoard schema. Safe to run more than once.
-- The CHECK constraints are a second line of defence: the service validates first,
-- but the database refuses bad rows even if some future code path forgets to.

CREATE TABLE IF NOT EXISTS deals (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_name   VARCHAR(60)  NOT NULL CHECK (char_length(btrim(company_name)) > 0),
    founder_name   VARCHAR(60)  NOT NULL CHECK (char_length(btrim(founder_name)) > 0),
    sector         VARCHAR(30)  NOT NULL,
    pitch          VARCHAR(140) NOT NULL CHECK (char_length(btrim(pitch)) > 0),
    funding_type   VARCHAR(10)  NOT NULL CHECK (funding_type IN ('Equity', 'Loan', 'Grant')),
    amount_inr     BIGINT       NOT NULL CHECK (amount_inr BETWEEN 10000 AND 1000000000),
    equity_percent NUMERIC(5,2) CHECK (equity_percent > 0 AND equity_percent < 100),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Equity asks must state a percentage; Loan and Grant asks must not.
    CONSTRAINT deals_equity_matches_type CHECK (
        (funding_type = 'Equity' AND equity_percent IS NOT NULL)
        OR (funding_type <> 'Equity' AND equity_percent IS NULL)
    )
);

-- Serves "newest first" (All) and "newest first for one type" (filter pills).
CREATE INDEX IF NOT EXISTS idx_deals_created      ON deals (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_deals_type_created ON deals (funding_type, created_at DESC, id DESC);
