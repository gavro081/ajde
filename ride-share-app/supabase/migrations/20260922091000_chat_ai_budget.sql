-- A rolling one-minute budget shared across rooms and application instances.
create table public.chat_ai_budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  admitted_at timestamptz[] not null default '{}'
);
alter table public.chat_ai_budgets enable row level security;
revoke all on public.chat_ai_budgets from public, anon, authenticated;

create function public.try_chat_ai_request()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  recent timestamptz[];
  checked_at timestamptz;
begin
  if actor is null then return false; end if;
  insert into public.chat_ai_budgets(user_id) values (actor) on conflict do nothing;
  select admitted_at into recent from public.chat_ai_budgets where user_id = actor for update;
  checked_at := clock_timestamp();
  select coalesce(array_agg(t), '{}'::timestamptz[]) into recent
    from unnest(recent) t where t > checked_at - interval '1 minute';
  if cardinality(recent) >= 5 then return false; end if;
  update public.chat_ai_budgets set admitted_at = array_append(recent, checked_at) where user_id = actor;
  return true;
end;
$$;
revoke all on function public.try_chat_ai_request() from public, anon;
grant execute on function public.try_chat_ai_request() to authenticated;
