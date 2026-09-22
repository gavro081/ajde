-- Current members may read the full room, including before their acceptance.
-- Preserve the signature used by the existing policies and send helper.
create or replace function public.can_read_ride_room(target_ride_id uuid, message_time timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rides r
    where r.id = target_ride_id and r.driver_id is not null and auth.uid() is not null
      and (r.driver_id = auth.uid() or exists (
        select 1 from public.bookings b where b.ride_id = r.id
          and b.passenger_id = auth.uid() and b.status = 'accepted'
          and b.decided_at is not null and b.decided_at <= statement_timestamp()
      ))
  );
$$;
revoke all on function public.can_read_ride_room(uuid, timestamptz) from public, anon;
grant execute on function public.can_read_ride_room(uuid, timestamptz) to authenticated;
