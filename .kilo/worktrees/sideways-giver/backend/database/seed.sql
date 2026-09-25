-- Demo data (fictional companies). Only inserts when the table is empty, so re-running is harmless.
INSERT INTO deals (company_name, founder_name, sector, pitch, funding_type, amount_inr, equity_percent, created_at)
SELECT * FROM (VALUES
  ('Kisan Cold Chain', 'Meera Patil',    'AgriTech',     'Solar cold storage for small farms, paid per crate stored',            'Equity',  7500000,  8.00::numeric, now() - interval '2 hours'),
  ('LedgerLoop',       'Arjun Menon',    'Fintech',      'Automated GST reconciliation for kirana distributors',                 'Equity', 20000000,  6.50::numeric, now() - interval '5 hours'),
  ('Ghar Ka Khana Co', 'Sneha Iyer',     'D2C',          'Home-cooked meal subscriptions from verified local cooks',             'Loan',    2500000,  NULL::numeric, now() - interval '9 hours'),
  ('PaathshalaAI',     'Rohan Verma',    'EdTech',       'Vernacular AI tutor for Class 8 to 10 maths',                          'Grant',   1500000,  NULL::numeric, now() - interval '1 day'),
  ('VoltRoute',        'Ishita Rao',     'Logistics',    'Route optimiser for electric last-mile delivery fleets',               'Equity', 35000000, 10.00::numeric, now() - interval '1 day 6 hours'),
  ('ClearScan Health', 'Dr. Kabir Shah', 'HealthTech',   'Low-cost retinal screening for rural clinics',                         'Grant',   5000000,  NULL::numeric, now() - interval '2 days'),
  ('SunPanel Chai',    'Anita Desai',    'Clean Energy', 'Rooftop solar leasing for small tea and food stalls',                  'Loan',    4000000,  NULL::numeric, now() - interval '3 days'),
  ('StackDesk',        'Vikram Nair',    'SaaS',         'Shared inbox and invoicing for freelancers in India',                  'Equity', 12000000,  7.50::numeric, now() - interval '3 days 8 hours'),
  ('Handloom Hub',     'Lakshmi Reddy',  'D2C',          'Direct-from-weaver marketplace with transparent pricing',              'Loan',    1800000,  NULL::numeric, now() - interval '4 days'),
  ('FarmPulse',        'Aman Gupta',     'AgriTech',     'Soil sensors that text farmers when to irrigate',                      'Grant',   3000000,  NULL::numeric, now() - interval '5 days')
) AS v(company_name, founder_name, sector, pitch, funding_type, amount_inr, equity_percent, created_at)
WHERE NOT EXISTS (SELECT 1 FROM deals);
