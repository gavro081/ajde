-- Included by schema_smoke.sql inside its rollback-only transaction.
create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception '%', message; end if;
end $$;

create function pg_temp.expect_error(statement text, expected_state text) returns void
language plpgsql as $$ begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'Statement should have failed with %: %', expected_state, statement;
end $$;

insert into auth.users (id)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(4, 8) n;
insert into public.profiles (id, full_name, photo_url, university)
select id, 'Policy student ' || id, 'https://example.com/test.jpg', 'UKIM'
from auth.users where id::text between '00000000-0000-0000-0000-000000000004' and '00000000-0000-0000-0000-000000000008';

insert into public.rides (id, driver_id, origin_city_id, dest_city_id, departure_at, seats_total, seats_available, status)
values ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 900001, 900002, now() - interval '1 hour', 8, 8, 'completed');
insert into public.bookings (ride_id, passenger_id, seats, status, decided_at) values
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 2, 'accepted', now() - interval '3 hours'),
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', 1, 'accepted', now() - interval '1 hour'),
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004', 1, 'requested', null),
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000005', 1, 'declined', now()),
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000006', 1, 'cancelled', now());

insert into public.messages (ride_id, sender_id, recipient_id, body, created_at) values
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', null, 'Before the second passenger joined', now() - interval '2 hours'),
('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Deferred direct message', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.messages (ride_id, sender_id, recipient_id, body)
values ('10000000-0000-0000-0000-000000000010', auth.uid(), null, 'Whole room');
select pg_temp.assert_true((select count(*) = 2 from public.messages), 'Driver sees room history only');
select pg_temp.expect_error($q$insert into public.messages (ride_id, sender_id, body, created_at) values ('10000000-0000-0000-0000-000000000010', auth.uid(), 'Forged clock', now() + interval '1 day')$q$, '42501');
select pg_temp.expect_error($q$insert into public.messages (ride_id, sender_id, recipient_id, body) values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000002', 'Direct')$q$, '42501');
select pg_temp.expect_error($q$insert into public.messages (ride_id, sender_id, body) values ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'Forged sender')$q$, '42501');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.assert_true((select count(*) = 2 from public.messages), 'First passenger sees both messages');
insert into public.messages (ride_id, sender_id, body)
values ('10000000-0000-0000-0000-000000000010', auth.uid(), 'Passenger reply');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select pg_temp.assert_true((select count(*) = 2 from public.messages), 'New passenger cannot see pre-acceptance history');

do $$ declare person uuid; begin
  for person in select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid from generate_series(4, 7) n loop
    perform set_config('request.jwt.claim.sub', person::text, true);
    perform pg_temp.assert_true((select count(*) = 0 from public.messages), 'Non-member sees no messages');
    perform pg_temp.expect_error($q$insert into public.messages (ride_id, sender_id, body) values ('10000000-0000-0000-0000-000000000010', auth.uid(), 'Not a member')$q$, '42501');
    perform pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score) values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000001', 5)$q$, '42501');
  end loop;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
insert into public.ratings (ride_id, rater_id, ratee_id, score, note)
values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000001', 4, 'Private feedback');
select pg_temp.assert_true((select count(*) = 1 from public.ratings), 'Rater sees own detail');
select pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score) values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000001', 5)$q$, '23505');
select pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score) values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000003', 5)$q$, '42501');
select pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score) values ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 5)$q$, '42501');
select pg_temp.expect_error($q$update public.ratings set score = 1$q$, '42501');
select pg_temp.expect_error($q$delete from public.ratings$q$, '42501');
select pg_temp.expect_error($q$update public.messages set body = 'Changed'$q$, '42501');
select pg_temp.expect_error($q$delete from public.messages$q$, '42501');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select pg_temp.assert_true((select count(*) = 0 from public.ratings), 'Passengers cannot read each other ratings');
insert into public.ratings (ride_id, rater_id, ratee_id, score)
values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000001', 2);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true((select count(*) = 2 from public.ratings), 'Ratee sees received detail');
insert into public.ratings (ride_id, rater_id, ratee_id, score)
values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000002', 5);
select pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score) values ('10000000-0000-0000-0000-000000000010', auth.uid(), auth.uid(), 5)$q$, '42501');
select pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score) values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000004', 5)$q$, '42501');
select pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score) values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000003', 0)$q$, '23514');
select pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score, note) values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000003', 5, repeat('x', 1001))$q$, '42501');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true((select count(*) = 0 from public.ratings), 'Anonymous cannot enumerate raw ratings');
select pg_temp.assert_true((select count(*) = 0 from public.messages), 'Anonymous cannot read messages');
select pg_temp.assert_true((select average = 3 and count = 2 from public.profile_rating_summary('00000000-0000-0000-0000-000000000001')), 'Public average counts each pair once despite multiple seats');
select pg_temp.assert_true((select average = 5 and count = 1 from public.profile_rating_summary('00000000-0000-0000-0000-000000000002')), 'Single public rating');
select pg_temp.assert_true((select average is null and count = 0 from public.profile_rating_summary('00000000-0000-0000-0000-000000000008')), 'Empty aggregate has no invented score');

reset role;
-- Invalid legacy rows must not pollute the aggregate.
insert into public.ratings (ride_id, rater_id, ratee_id, score)
values ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 1);
select pg_temp.assert_true((select average = 3 and count = 2 from public.profile_rating_summary('00000000-0000-0000-0000-000000000001')), 'Ineligible legacy rating excluded');
update public.bookings set status = 'cancelled' where ride_id = '10000000-0000-0000-0000-000000000010' and passenger_id = '00000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select pg_temp.assert_true((select count(*) = 0 from public.messages), 'Booking cancellation immediately removes all history');
select pg_temp.expect_error($q$insert into public.messages (ride_id, sender_id, body) values ('10000000-0000-0000-0000-000000000010', auth.uid(), 'Cancelled passenger')$q$, '42501');

reset role;
update public.rides set departure_at = now() - interval '48 hours' where id = '10000000-0000-0000-0000-000000000010';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_error($q$insert into public.messages (ride_id, sender_id, body) values ('10000000-0000-0000-0000-000000000010', auth.uid(), 'Expired')$q$, '42501');
reset role;
update public.rides set status = 'cancelled', departure_at = now() where id = '10000000-0000-0000-0000-000000000010';
set local role authenticated;
select pg_temp.assert_true((select count(*) = 3 from public.messages), 'Cancelled ride retains authorized read history');
select pg_temp.expect_error($q$insert into public.messages (ride_id, sender_id, body) values ('10000000-0000-0000-0000-000000000010', auth.uid(), 'Cancelled ride')$q$, '42501');
select pg_temp.expect_error($q$insert into public.ratings (ride_id, rater_id, ratee_id, score) values ('10000000-0000-0000-0000-000000000010', auth.uid(), '00000000-0000-0000-0000-000000000002', 5)$q$, '42501');
reset role;
select pg_temp.assert_true(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'), 'Messages are published for Realtime');
