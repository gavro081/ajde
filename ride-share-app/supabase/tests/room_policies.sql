-- Included by schema_smoke.sql; isolated JWT identities, all writes rolled back.
begin;
insert into auth.users(id) select ('91000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,8)n;
insert into public.profiles(id,full_name,photo_url,university)
select id, 'Policy Student', 'https://example.com/photo.png','UKIM' from auth.users where id::text like '91000000%';
insert into public.rides(id,driver_id,origin_city_id,dest_city_id,departure_at,seats_total,seats_available,status)
values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',1,2,now()-interval '1 hour',8,8,'published');
insert into public.bookings(ride_id,passenger_id,status,decided_at)
select '92000000-0000-4000-8000-000000000001', ('91000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
case when n in (2,3,4) then 'accepted'::public.booking_status when n=5 then 'requested'::public.booking_status when n=6 then 'declined'::public.booking_status else 'cancelled'::public.booking_status end,
case when n=4 then now()+interval '1 minute' else now()-interval '1 hour' end
from generate_series(2,7)n;
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.denied(sql text) returns void language plpgsql as $$
begin
  begin execute sql; exception when insufficient_privilege then return; end;
  raise exception 'Expected authorization denial';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
insert into public.messages(ride_id,sender_id,body,created_at) values
('92000000-0000-4000-8000-000000000001',auth.uid(),'First room message',now()+interval '1 year');
select pg_temp.assert_true((select bool_and(created_at <= statement_timestamp()) from public.messages),'timestamp cannot be forged');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*) from public.messages)= 1,'visibility member 1');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*) from public.messages)= 1,'visibility member 2');
select pg_temp.assert_true(public.can_send_ride_room('92000000-0000-4000-8000-000000000001'),'accepted member can send');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*) from public.messages)= 1,'visibility member 3');
select pg_temp.assert_true(public.can_send_ride_room('92000000-0000-4000-8000-000000000001'),'accepted member can send');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((select count(*) from public.messages)= 0,'visibility member 4');
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'not allowed')$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000005',true);
select pg_temp.assert_true((select count(*) from public.messages)= 0,'visibility member 5');
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'not allowed')$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000006',true);
select pg_temp.assert_true((select count(*) from public.messages)= 0,'visibility member 6');
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'not allowed')$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000007',true);
select pg_temp.assert_true((select count(*) from public.messages)= 0,'visibility member 7');
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'not allowed')$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000008',true);
select pg_temp.assert_true((select count(*) from public.messages)= 0,'visibility member 8');
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'not allowed')$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','forged')$q$);
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,recipient_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'91000000-0000-4000-8000-000000000001','DM')$q$);
select pg_temp.denied($q$update public.messages set body='edited'$q$);
select pg_temp.denied($q$delete from public.messages$q$);
select pg_temp.denied($q$insert into public.ratings(ride_id,rater_id,ratee_id,score) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'91000000-0000-4000-8000-000000000001',5)$q$);
reset role;
update public.bookings set decided_at=statement_timestamp() where passenger_id='91000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((select count(*) from public.messages)=1,'new member reads old history');
insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'New member reply');
select pg_temp.assert_true((select count(*) from public.messages)=2,'new member sees old history and own reply');
reset role;
update public.bookings set status='cancelled' where passenger_id='91000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*) from public.messages)=0,'cancelled member immediately loses history');
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'cancelled')$q$);
reset role;
-- Reacceptance restores all earlier messages, not just the second acceptance window.
update public.bookings set status='accepted', decided_at=statement_timestamp()
where passenger_id='91000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.assert_true((select count(*) from public.messages)=2,'reaccepted member regains full history');
reset role;
update public.rides set status='cancelled' where id='92000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*) from public.messages)=2,'cancelled ride retains member history');
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'ride cancelled')$q$);
reset role;
update public.rides set status='completed' where id='92000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.assert_true(public.can_send_ride_room('92000000-0000-4000-8000-000000000001'),'completed ride within window allows sends');
insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'Thanks');
insert into public.ratings(ride_id,rater_id,ratee_id,score,note) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'91000000-0000-4000-8000-000000000001',4,'Private note');
select pg_temp.denied($q$insert into public.ratings(ride_id,rater_id,ratee_id,score) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'91000000-0000-4000-8000-000000000004',5)$q$);
select pg_temp.denied($q$insert into public.ratings(ride_id,rater_id,ratee_id,score) values ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000001',5)$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*) from public.ratings)=1,'ratee can read private feedback');
insert into public.ratings(ride_id,rater_id,ratee_id,score) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'91000000-0000-4000-8000-000000000003',5);
select pg_temp.denied($q$update public.ratings set score=1$q$);
select pg_temp.denied($q$delete from public.ratings$q$);
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000008',true);
select pg_temp.assert_true((select count(*) from public.ratings)=0,'unrelated user cannot read raw feedback');
select pg_temp.denied($q$insert into public.ratings(ride_id,rater_id,ratee_id,score) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'91000000-0000-4000-8000-000000000001',5)$q$);
reset role;
update public.rides set departure_at=now()-interval '49 hours' where id='92000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select pg_temp.denied($q$insert into public.messages(ride_id,sender_id,body) values ('92000000-0000-4000-8000-000000000001',auth.uid(),'expired')$q$);
set local role anon;
select pg_temp.denied('select * from public.messages');
select pg_temp.denied('select * from public.ratings');
select pg_temp.assert_true((select average=4 and count=1 from public.profile_rating_summary('91000000-0000-4000-8000-000000000001')),'public aggregate only');
select pg_temp.assert_true((select average is null and count=0 from public.profile_rating_summary('91000000-0000-4000-8000-000000000008')),'empty aggregate');
reset role;
rollback;
