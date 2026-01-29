-- Fix trigger syntax for PostgreSQL compatibility (42P17 invalid_object_definition)
-- Drops triggers and recreates with EXECUTE PROCEDURE

-- daily_box_entries triggers
DROP TRIGGER IF EXISTS calculate_sold_amount_trigger ON public.daily_box_entries;
DROP TRIGGER IF EXISTS ticket_continuity_check ON public.daily_box_entries;
DROP TRIGGER IF EXISTS update_daily_box_entries_updated_at ON public.daily_box_entries;

CREATE TRIGGER calculate_sold_amount_trigger
  BEFORE INSERT OR UPDATE ON public.daily_box_entries
  FOR EACH ROW
  EXECUTE PROCEDURE calculate_sold_amount();

CREATE TRIGGER ticket_continuity_check
  AFTER INSERT OR UPDATE ON public.daily_box_entries
  FOR EACH ROW
  EXECUTE PROCEDURE check_ticket_continuity();

CREATE TRIGGER update_daily_box_entries_updated_at BEFORE UPDATE ON public.daily_box_entries
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
