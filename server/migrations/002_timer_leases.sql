create table if not exists public.lifeos_timer_leases (
 owner_id uuid primary key references public.lifeos_users(id) on delete cascade,
 timer_id text not null, device_id text not null, revision bigint not null default 1,
 expires_at timestamptz not null, released boolean not null default false
);
alter table public.lifeos_timer_leases enable row level security;
revoke all on public.lifeos_timer_leases from anon,authenticated;
grant all on public.lifeos_timer_leases to service_role;
create or replace function public.lifeos_timer_lease(p_owner uuid,p_timer text,p_device text,p_revision bigint,p_action text,p_takeover boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r lifeos_timer_leases;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,1));
 select * into r from lifeos_timer_leases where owner_id=p_owner for update;
 if coalesce(r.revision,0)<>p_revision then return jsonb_build_object('status','conflict','lease',to_jsonb(r)); end if;
 if p_action='renew' or p_action='release' then
  if r.owner_id is null or r.timer_id<>p_timer or r.device_id<>p_device or r.released or r.expires_at<=now() then
   return jsonb_build_object('status','conflict','lease',to_jsonb(r));
  end if;
  update lifeos_timer_leases set expires_at=now()+interval '90 seconds',released=p_action='release',revision=revision+case when p_action='release' then 1 else 0 end where owner_id=p_owner returning * into r;
 else
  if r.owner_id is not null and not r.released and (r.device_id<>p_device or r.timer_id<>p_timer) and not p_takeover then
   return jsonb_build_object('status','conflict','lease',to_jsonb(r));
  end if;
  insert into lifeos_timer_leases(owner_id,timer_id,device_id,revision,expires_at,released)
  values(p_owner,p_timer,p_device,coalesce(r.revision,0)+1,now()+interval '90 seconds',false)
  on conflict(owner_id) do update set timer_id=excluded.timer_id,device_id=excluded.device_id,revision=excluded.revision,expires_at=excluded.expires_at,released=false returning * into r;
 end if;
 return jsonb_build_object('status',case when p_action='release' then 'released' else 'acquired' end,'lease',to_jsonb(r));
end; $$;
revoke all on function public.lifeos_timer_lease(uuid,text,text,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.lifeos_timer_lease(uuid,text,text,bigint,text,boolean) to service_role;
