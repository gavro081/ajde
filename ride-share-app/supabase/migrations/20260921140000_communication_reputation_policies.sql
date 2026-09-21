-- Shared contract for ride rooms and post-ride ratings. Also reconciles the
-- same helpers if they were installed manually in the development project.
alter table public.messages alter column recipient_id drop not null;
alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_check
  check (recipient_id is null or sender_id <> recipient_id);

alter table public.messages enable row level security;
alter table public.ratings enable row level security;

-- These functions bypass unrelated tables' RLS only to answer questions about
-- the caller. No caller-supplied identity and no participant rows are returned.
create or replace function public.can_read_ride_room(target_ride_id uuid, message_time timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.rides r
    where r.id = target_ride_id and r.driver_id is not null
      and (r.driver_id = auth.uid() or exists (
        select 1 from public.bookings b
        where b.ride_id = r.id and b.passenger_id = auth.uid()
          and b.status = 'accepted' and b.decided_at <= message_time
      ))
  );
$$;

create or replace function public.can_send_ride_room(target_ride_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_read_ride_room(target_ride_id, statement_timestamp()) and exists (
    select 1 from public.rides r where r.id = target_ride_id
      and r.status <> 'cancelled'
      and statement_timestamp() < r.departure_at + interval '48 hours'
  );
$$;

create or replace function public.can_rate_ride(target_ride_id uuid, target_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and auth.uid() <> target_profile_id and exists (
    select 1 from public.rides r
    where r.id = target_ride_id and r.status = 'completed' and r.driver_id is not null
      and (
        (r.driver_id = auth.uid() and exists (
          select 1 from public.bookings b where b.ride_id = r.id
            and b.passenger_id = target_profile_id and b.status = 'accepted'
        )) or (r.driver_id = target_profile_id and exists (
          select 1 from public.bookings b where b.ride_id = r.id
            and b.passenger_id = auth.uid() and b.status = 'accepted'
        ))
      )
  );
$$;

create or replace function public.profile_rating_summary(target_profile_id uuid)
returns table (average numeric, count bigint)
language sql stable security definer set search_path = '' as $$
  select avg(rt.score)::numeric, count(*)
  from public.ratings rt join public.rides r on r.id = rt.ride_id
  where rt.ratee_id = target_profile_id and r.status = 'completed'
    and rt.rater_id <> rt.ratee_id and rt.score between 1 and 5
    and (
      (rt.rater_id = r.driver_id and exists (
        select 1 from public.bookings b where b.ride_id = r.id
          and b.passenger_id = rt.ratee_id and b.status = 'accepted'
      )) or (rt.ratee_id = r.driver_id and exists (
        select 1 from public.bookings b where b.ride_id = r.id
          and b.passenger_id = rt.rater_id and b.status = 'accepted'
      ))
    );
$$;

revoke all on function public.can_read_ride_room(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.can_send_ride_room(uuid) from public, anon, authenticated;
revoke all on function public.can_rate_ride(uuid, uuid) from public, anon, authenticated;
revoke all on function public.profile_rating_summary(uuid) from public, anon, authenticated;
grant execute on function public.can_read_ride_room(uuid, timestamptz) to authenticated;
grant execute on function public.can_send_ride_room(uuid) to authenticated;
grant execute on function public.can_rate_ride(uuid, uuid) to authenticated;
grant execute on function public.profile_rating_summary(uuid) to anon, authenticated;

drop policy if exists room_members_read on public.messages;
create policy room_members_read on public.messages for select to authenticated
using (recipient_id is null and public.can_read_ride_room(ride_id, created_at));
drop policy if exists room_members_send on public.messages;
create policy room_members_send on public.messages for insert to authenticated
with check (sender_id = auth.uid() and recipient_id is null
  and public.can_send_ride_room(ride_id)
  and public.can_read_ride_room(ride_id, created_at));
drop policy if exists counterparts_read_ratings on public.ratings;
create policy counterparts_read_ratings on public.ratings for select to authenticated
using (auth.uid() = rater_id or auth.uid() = ratee_id);
drop policy if exists participants_rate on public.ratings;
create policy participants_rate on public.ratings for insert to authenticated
with check (rater_id = auth.uid() and public.can_rate_ride(ride_id, ratee_id)
  and (note is null or (note = btrim(note) and char_length(note) between 1 and 1000)));

-- No client edits/deletes, forged timestamps, read receipts, or supplied IDs.
revoke all on public.messages, public.ratings from public, anon, authenticated;
grant select on public.messages, public.ratings to anon, authenticated;
grant insert (ride_id, sender_id, recipient_id, body) on public.messages to authenticated;
grant insert (ride_id, rater_id, ratee_id, score, note) on public.ratings to authenticated;

create or replace function public.stamp_room_message() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.created_at := statement_timestamp();
    new.read_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_room_message() from public, anon, authenticated;
drop trigger if exists messages_stamp on public.messages;
create trigger messages_stamp before insert on public.messages
for each row execute function public.stamp_room_message();

-- Dimi's history query: ride_id + recipient_id IS NULL, ordered/paged by
-- (created_at, id). The original direct-message index remains for legacy data.
create index if not exists messages_room_cursor_idx
  on public.messages (ride_id, created_at desc, id desc) where recipient_id is null;

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
    and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
