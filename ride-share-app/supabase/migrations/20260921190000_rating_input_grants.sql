-- Preserve the deployed shared room checkpoint. Tighten only rating inputs.
-- The database continues to assign rating IDs and creation timestamps.
revoke insert on public.ratings from authenticated;
grant insert (ride_id, rater_id, ratee_id, score, note) on public.ratings to authenticated;

alter policy participants_rate on public.ratings
with check (rater_id = auth.uid() and public.can_rate_ride(ride_id, ratee_id)
  and (note is null or (note = regexp_replace(note, '^\s+|\s+$', '', 'g')
    and char_length(note) between 1 and 1000)));
