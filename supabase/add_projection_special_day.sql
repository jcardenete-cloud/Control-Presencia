ALTER TABLE jcf.projection_days
ADD COLUMN IF NOT EXISTS special_day text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'projection_days_special_day_check'
          AND conrelid = 'jcf.projection_days'::regclass
    ) THEN
        ALTER TABLE jcf.projection_days
        ADD CONSTRAINT projection_days_special_day_check
        CHECK (special_day IS NULL OR special_day IN ('festivo', 'vacaciones', 'puente'));
    END IF;
END;
$$;

COMMENT ON COLUMN jcf.projection_days.special_day IS
'Tipo de día especial: festivo, vacaciones o puente.';