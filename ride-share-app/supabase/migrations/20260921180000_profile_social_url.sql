-- A service-independent profile link; existing Facebook/Instagram fields remain supported.
alter table public.profiles add column social_url text;
alter table public.profiles add constraint profiles_social_url_length
  check (social_url is null or char_length(social_url) <= 500);
comment on column public.profiles.social_url is 'Optional HTTPS social profile URL, validated by profile actions.';
