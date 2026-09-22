begin;
insert into auth.users(id) values ('93000000-0000-4000-8000-000000000001'), ('93000000-0000-4000-8000-000000000002');
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(public.try_chat_ai_request(), 'first five requests admitted') from generate_series(1,5);
select pg_temp.assert_true(not public.try_chat_ai_request(), 'sixth request denied');
do $$ begin
  begin perform * from public.chat_ai_budgets; raise exception 'budget SELECT should fail'; exception when insufficient_privilege then null; end;
  begin delete from public.chat_ai_budgets; raise exception 'budget DELETE should fail'; exception when insufficient_privilege then null; end;
  begin insert into public.chat_ai_budgets(user_id) values (auth.uid()); raise exception 'budget INSERT should fail'; exception when insufficient_privilege then null; end;
  begin update public.chat_ai_budgets set admitted_at='{}'; raise exception 'budget UPDATE should fail'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true(public.try_chat_ai_request(), 'different member has own budget');
reset role;
update public.chat_ai_budgets set admitted_at=array[clock_timestamp()-interval '61 seconds'] where user_id='93000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(public.try_chat_ai_request(), 'old admissions expire');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert_true(not public.try_chat_ai_request(), 'missing identity denied');
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.try_chat_ai_request()','execute'), 'no anonymous execution');
select pg_temp.assert_true(pg_get_function_arguments('public.try_chat_ai_request()'::regprocedure)='', 'caller cannot choose a charged identity');
rollback;
