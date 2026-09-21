-- One shared permit across server instances, not one timer per browser or process.
create table public.ride_routing_gate (
  id boolean primary key default true check (id),
  last_request_at timestamptz not null default '-infinity'
);
insert into public.ride_routing_gate (id) values (true);
alter table public.ride_routing_gate enable row level security;
revoke all on public.ride_routing_gate from anon, authenticated;

create function public.try_ride_routing_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare previous_time timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select last_request_at into previous_time from public.ride_routing_gate where id for update;
  -- Small safety margin over the public provider's one-request-per-second limit.
  if clock_timestamp() < previous_time + interval '1200 milliseconds' then return false; end if;
  update public.ride_routing_gate set last_request_at = clock_timestamp() where id;
  return true;
end;
$$;
revoke all on function public.try_ride_routing_request() from public, anon;
grant execute on function public.try_ride_routing_request() to authenticated;
