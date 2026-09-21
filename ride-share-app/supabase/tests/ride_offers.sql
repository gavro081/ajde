-- Isolated authentication identity; every row is rolled back.
begin;
insert into auth.users(id) values ('93000000-0000-4000-8000-000000000001');
insert into public.profiles(id,full_name,photo_url,university)
values ('93000000-0000-4000-8000-000000000001','Offer Verification','https://example.com/photo.png','UKIM');
set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-4000-8000-000000000001',true);
do $$
declare
  offer jsonb := jsonb_build_object('source','native','origin',jsonb_build_object('cityId',1),
    'destination',jsonb_build_object('cityId',3),'departureAt',now()+interval '7 days',
    'seatsTotal',3,'pricePerSeatMkd',400,'tags','[]'::jsonb,'genderPreference','any');
  vehicle jsonb := '{"mode":"manual","make":"Verification","model":"Compact","fuelType":"petrol","consumptionL100Km":6,"seatsTotal":4}';
  first_result jsonb;
  retry_result jsonb;
  sibling jsonb;
  bad_value jsonb;
begin
  first_result := public.create_ride_offer(offer,vehicle,'94000000-0000-4000-8000-000000000001');
  retry_result := public.create_ride_offer(offer,vehicle,'94000000-0000-4000-8000-000000000001');
  sibling := public.create_ride_offer(offer,vehicle,'94000000-0000-4000-8000-000000000002');
  if first_result <> retry_result then raise exception 'Retry created a different result'; end if;
  if first_result->>'rideId' = sibling->>'rideId' then raise exception 'Sibling lost its identity'; end if;
  if first_result->>'carId' <> sibling->>'carId' then raise exception 'Sibling duplicated the same car'; end if;
  for bad_value in select value from jsonb_array_elements('[{"departureAt":"infinity"},{"distanceKm":"Infinity"},{"distanceKm":"NaN"}]'::jsonb) loop
    begin
      perform public.create_ride_offer(offer || bad_value,vehicle,gen_random_uuid());
      raise exception 'Non-finite ride value accepted';
    exception when check_violation then null; end;
  end loop;
  begin
    perform public.create_ride_offer(offer,vehicle || '{"consumptionL100Km":"NaN"}',gen_random_uuid());
    raise exception 'Non-finite consumption accepted';
  exception when check_violation then null; end;
  begin
    perform public.create_ride_offer(offer || '{"source":"imported","importId":"95000000-0000-4000-8000-000000000001"}',vehicle,'94000000-0000-4000-8000-000000000003');
    raise exception 'Unowned import accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_ride_offer(offer,'{"mode":"existing","carId":"95000000-0000-4000-8000-000000000001"}','94000000-0000-4000-8000-000000000004');
    raise exception 'Unowned car accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_ride_offer(offer || '{"seatsTotal":8}',vehicle,'94000000-0000-4000-8000-000000000005');
    raise exception 'Excess capacity accepted';
  exception when check_violation then null; end;
  begin
    perform public.create_ride_offer(offer || '{"destination":{"cityId":999999}}',vehicle || '{"model":"Rollback only"}','94000000-0000-4000-8000-000000000006');
    raise exception 'Invalid city accepted';
  exception when foreign_key_violation then null; end;
  if (select count(*) from public.cars where owner_id=auth.uid()) <> 1 then raise exception 'Failed publication left an orphan car'; end if;
end $$;
reset role;
rollback;
