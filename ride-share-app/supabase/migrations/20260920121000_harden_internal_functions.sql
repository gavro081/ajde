-- Trigger helpers maintain database invariants and must continue to work once
-- RLS is enabled. Run them as their owner, with fixed search paths, and prevent
-- clients from invoking them directly through PostgREST RPC endpoints.

alter function public.set_updated_at() security definer;
alter function public.recalculate_ride_seats(uuid) security definer;
alter function public.sync_ride_seats() security definer;
alter function public.guard_booking_identity() security definer;
alter function public.guard_ride_capacity_change() security definer;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.recalculate_ride_seats(uuid) from public, anon, authenticated;
revoke execute on function public.sync_ride_seats() from public, anon, authenticated;
revoke execute on function public.guard_booking_identity() from public, anon, authenticated;
revoke execute on function public.guard_ride_capacity_change() from public, anon, authenticated;
