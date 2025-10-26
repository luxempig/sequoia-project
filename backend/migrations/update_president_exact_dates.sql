-- Update existing presidents to exact term dates

-- Herbert Hoover: Inaugurated March 4, 1929; term ended March 4, 1933
UPDATE sequoia.presidents
SET term_start = '1929-03-04',
    term_end = '1933-03-04',
    updated_at = CURRENT_TIMESTAMP
WHERE president_slug = 'herbert-hoover-3';

-- Franklin D. Roosevelt: Inaugurated March 4, 1933; died in office April 12, 1945
UPDATE sequoia.presidents
SET term_start = '1933-03-04',
    term_end = '1945-04-12',
    updated_at = CURRENT_TIMESTAMP
WHERE president_slug = 'franklin-d-roosevelt';
