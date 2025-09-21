-- Ensure public read access to active products exists and is correct
-- This migration is idempotent: it will CREATE the policy if missing or ALTER it if present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'Anyone can view active products'
  ) THEN
    EXECUTE $$
      ALTER POLICY "Anyone can view active products" ON public.products
      USING (
        active = TRUE
      )
    $$;
  ELSE
    EXECUTE $$
      CREATE POLICY "Anyone can view active products" ON public.products
      FOR SELECT
      USING (
        active = TRUE
      )
    $$;
  END IF;
END $$;

-- Optional: verify in_stock flag coherence with stock_count (non-destructive)
-- Products with stock_count > 0 should have in_stock = true for consistent filters.
UPDATE public.products
SET in_stock = TRUE
WHERE stock_count > 0 AND COALESCE(in_stock, FALSE) = FALSE;
