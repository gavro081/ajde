-- One ride is one room. Non-null recipients remain deferred legacy DM data.
alter table public.messages alter column recipient_id drop not null;
-- The existing sender <> recipient check already permits NULL under SQL semantics.
alter table public.messages enable row level security;
alter table public.ratings enable row level security;

create function public.can_read_ride_room(target_ride_id uuid, message_time timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rides r
    where r.id = target_ride_id and r.driver_id is not null and auth.uid() is not null
      and (r.driver_id = auth.uid() or exists (
        select 1 from public.bookings b where b.ride_id = r.id
          and b.passenger_id = auth.uid() and b.status = 'accepted'
          and b.decided_at <= message_time
      ))
  );
$$;

create function public.can_send_ride_room(target_ride_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_read_ride_room(target_ride_id, statement_timestamp()) and exists (
    select 1 from public.rides r where r.id = target_ride_id
      and r.status <> 'cancelled'
      and r.departure_at >= statement_timestamp() - interval '48 hours'
  );
$$;

-- Prevent clients from changing when a message becomes visible to later members.
create function public.stamp_room_message()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_at := statement_timestamp();
  new.read_at := null;
  return new;
end;
$$;
create trigger messages_stamp before insert on public.messages
for each row execute function public.stamp_room_message();

create policy room_members_read on public.messages for select to authenticated
using (recipient_id is null and public.can_read_ride_room(ride_id, created_at));
create policy room_members_send on public.messages for insert to authenticated
with check (sender_id = auth.uid() and recipient_id is null
  and public.can_send_ride_room(ride_id)
  and public.can_read_ride_room(ride_id, created_at));

create function public.can_rate_ride(target_ride_id uuid, target_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and auth.uid() <> target_profile_id and exists (
    select 1 from public.rides r where r.id = target_ride_id and r.status = 'completed'
      and r.driver_id is not null and (
        (r.driver_id = auth.uid() and exists (
          select 1 from public.bookings b where b.ride_id = r.id
            and b.passenger_id = target_profile_id and b.status = 'accepted'))
        or (r.driver_id = target_profile_id and exists (
          select 1 from public.bookings b where b.ride_id = r.id
            and b.passenger_id = auth.uid() and b.status = 'accepted'))
      )
  );
$$;
create policy participants_rate on public.ratings for insert to authenticated
with check (rater_id = auth.uid() and public.can_rate_ride(ride_id, ratee_id));
create policy counterparts_read_ratings on public.ratings for select to authenticated
using (auth.uid() in (rater_id, ratee_id));

create function public.profile_rating_summary(target_profile_id uuid)
returns table (average numeric, count bigint)
language sql stable security definer set search_path = '' as $$
  select avg(rt.score)::numeric, count(*) from public.ratings rt
  join public.rides r on r.id = rt.ride_id
  where rt.ratee_id = target_profile_id and r.status = 'completed'
    and rt.rater_id <> rt.ratee_id and (
      (rt.rater_id = r.driver_id and exists (
        select 1 from public.bookings b where b.ride_id = r.id
          and b.passenger_id = rt.ratee_id and b.status = 'accepted'))
      or (rt.ratee_id = r.driver_id and exists (
        select 1 from public.bookings b where b.ride_id = r.id
          and b.passenger_id = rt.rater_id and b.status = 'accepted'))
    );
$$;

revoke all on function public.can_read_ride_room(uuid, timestamptz),
  public.can_send_ride_room(uuid), public.can_rate_ride(uuid, uuid),
  public.profile_rating_summary(uuid), public.stamp_room_message() from public, anon, authenticated;
grant execute on function public.can_read_ride_room(uuid, timestamptz),
  public.can_send_ride_room(uuid), public.can_rate_ride(uuid, uuid) to authenticated;
grant execute on function public.profile_rating_summary(uuid) to anon, authenticated;
revoke all on public.messages, public.ratings from anon, authenticated;
grant select, insert on public.messages, public.ratings to authenticated;

drop index public.messages_conversation_idx;
create index messages_room_cursor_idx on public.messages (ride_id, created_at desc, id desc)
where recipient_id is null;
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
