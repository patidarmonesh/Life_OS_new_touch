-- Run once in the Supabase SQL editor. The application uses a server-only BFF.
-- No browser role receives table/RPC access. All access is verified in server/routes.js.
create table if not exists public.lifeos_users (
 id uuid primary key default gen_random_uuid(), google_sub text unique not null,
 name text not null default '', email text not null default '', picture text,
 source_revision bigint not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.lifeos_sessions (
 token_hash text primary key, owner_id uuid not null references public.lifeos_users(id) on delete cascade,
 csrf text not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.lifeos_oauth_states (
 state_hash text primary key, cookie_hash text not null, verifier text not null, nonce text not null,
 purpose text not null, owner_id uuid references public.lifeos_users(id) on delete cascade,
 expires_at timestamptz not null
);
create table if not exists public.lifeos_connections (
 owner_id uuid primary key references public.lifeos_users(id) on delete cascade,
 google_sub text not null, refresh_cipher text, access_cipher text, expires_at timestamptz,
 scopes text not null default '', state text not null default 'connected', calendar_id text
);
create table if not exists public.lifeos_records (
 owner_id uuid not null references public.lifeos_users(id) on delete cascade,
 collection text not null, id text not null, revision bigint not null default 1,
 sequence bigint generated always as identity, body jsonb not null, deleted boolean not null default false,
 updated_at timestamptz not null default now(), primary key(owner_id, collection, id)
);
create table if not exists public.lifeos_mutations (
 owner_id uuid not null references public.lifeos_users(id) on delete cascade,
 id text not null, response jsonb not null, created_at timestamptz not null default now(), primary key(owner_id,id)
);
create table if not exists public.lifeos_shares (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.lifeos_users(id) on delete cascade,
 token_hash text unique not null, payload jsonb not null, expires_at timestamptz not null,
 revoked_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.lifeos_leases (key text primary key, holder text not null, expires_at timestamptz not null);
create table if not exists public.lifeos_quotas (
 owner_id uuid not null references public.lifeos_users(id) on delete cascade,
 day date not null, requests integer not null default 0, input_chars integer not null default 0,
 primary key(owner_id,day)
);
create table if not exists public.lifeos_push_subscriptions (
 owner_id uuid not null references public.lifeos_users(id) on delete cascade, id text not null,
 subscription jsonb not null, enabled boolean not null default true, created_at timestamptz not null default now(),
 primary key(owner_id,id)
);
create table if not exists public.lifeos_reminders (
 id text primary key, owner_id uuid not null references public.lifeos_users(id) on delete cascade,
 plan_id text not null, plan_revision integer not null, block_id text not null, due_at timestamptz not null,
 title text not null, url text not null, status text not null default 'pending', attempts integer not null default 0,
 last_error text, delivered_at timestamptz
);
create table if not exists public.lifeos_calendar_exports (
 owner_id uuid not null references public.lifeos_users(id) on delete cascade,
 plan_id text not null, block_id text not null, revision integer not null,
 event_id text not null, etag text, primary key(owner_id,plan_id,block_id)
);

create or replace function public.lifeos_take_lease(p_key text,p_holder text,p_seconds integer)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 insert into lifeos_leases values(p_key,p_holder,now()+make_interval(secs=>least(p_seconds,120)))
 on conflict(key) do update set holder=excluded.holder,expires_at=excluded.expires_at where lifeos_leases.expires_at<now();
 return found;
end; $$;

create or replace function public.lifeos_consume_quota(p_owner uuid,p_chars integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare r lifeos_quotas;
begin
 insert into lifeos_quotas(owner_id,day,requests,input_chars) values(p_owner,current_date,1,p_chars)
 on conflict(owner_id,day) do update set requests=lifeos_quotas.requests+1,input_chars=lifeos_quotas.input_chars+p_chars
 where lifeos_quotas.requests<60 and lifeos_quotas.input_chars+p_chars<=500000 returning * into r;
 return r.owner_id is not null;
end; $$;

create or replace function public.lifeos_apply_mutation(p_owner uuid,p_mutation jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare prior jsonb; current_record lifeos_records; resulting lifeos_records; r jsonb; p jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select response into prior from lifeos_mutations where owner_id=p_owner and id=p_mutation->>'id';
 if prior is not null then return prior; end if;
 select * into current_record from lifeos_records where owner_id=p_owner and collection=p_mutation->>'collection' and id=p_mutation->>'recordId' for update;
 if coalesce(current_record.revision,0) <> (p_mutation->>'baseRevision')::bigint then
   return jsonb_build_object('status','conflict','record',to_jsonb(current_record));
 end if;
 -- Explicit parent links cannot cross an owner boundary, even through this privileged RPC.
 for p in select * from jsonb_array_elements(coalesce(p_mutation->'parents','[]')) loop
   if not exists(select 1 from lifeos_records where owner_id=p_owner and collection=p->>'collection' and id=p->>'id' and not deleted) then
     return jsonb_build_object('status','invalid_parent');
   end if;
 end loop;
 insert into lifeos_records(owner_id,collection,id,revision,body,deleted)
 values(p_owner,p_mutation->>'collection',p_mutation->>'recordId',coalesce(current_record.revision,0)+1,p_mutation->'body',coalesce((p_mutation->>'deleted')::boolean,false))
 on conflict(owner_id,collection,id) do update set revision=excluded.revision,body=excluded.body,deleted=excluded.deleted,updated_at=now()
 returning * into resulting;
 -- A change invalidates every derived read model through the authoritative source revision.
 update lifeos_users set source_revision=source_revision+1 where id=p_owner;
 r=jsonb_build_object('status','synced','record',to_jsonb(resulting));
 insert into lifeos_mutations(owner_id,id,response) values(p_owner,p_mutation->>'id',r);
 return r;
end; $$;

do $$ declare table_name text; begin
 foreach table_name in array array['lifeos_users','lifeos_sessions','lifeos_oauth_states','lifeos_connections','lifeos_records','lifeos_mutations','lifeos_shares','lifeos_leases','lifeos_quotas','lifeos_push_subscriptions','lifeos_reminders','lifeos_calendar_exports'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('revoke all on public.%I from anon, authenticated',table_name);
  execute format('grant all on public.%I to service_role',table_name);
 end loop;
end $$;
revoke all on function public.lifeos_take_lease(text,text,integer) from public,anon,authenticated;
revoke all on function public.lifeos_consume_quota(uuid,integer) from public,anon,authenticated;
revoke all on function public.lifeos_apply_mutation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.lifeos_take_lease(text,text,integer) to service_role;
grant execute on function public.lifeos_consume_quota(uuid,integer) to service_role;
grant execute on function public.lifeos_apply_mutation(uuid,jsonb) to service_role;
grant usage,select on sequence public.lifeos_records_sequence_seq to service_role;
