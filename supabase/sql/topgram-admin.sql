-- TopGram administrative RPCs. Apply only to the Supabase project dedicated to TopGram.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to service_role;

create or replace function private.tg_admin_action(p_actor uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_role text; v_target public.tg_profiles%rowtype; v_delta bigint; v_reason text;
 v_gift public.tg_gift_catalog%rowtype; v_serial integer; v_gift_id uuid; v_user_id uuid; v_username text;
begin
 select u.raw_app_meta_data->>'topgram_role' into v_role from auth.users u where u.id=p_actor;
 if coalesce(v_role,'') not in ('owner','admin') then raise exception 'Not authorized'; end if;
 if p_action='grant_stars' then
  v_username:=lower(trim(p_payload->>'username'));v_delta:=(p_payload->>'delta')::bigint;
  v_reason:=left(trim(coalesce(p_payload->>'reason','Admin adjustment')),240);
  if v_delta=0 or abs(v_delta)>1000000000 or v_reason='' then raise exception 'Invalid star adjustment'; end if;
  select * into v_target from public.tg_profiles where username=v_username and deleted_at is null for update;
  if not found then raise exception 'User not found'; end if;
  if v_target.stars+v_delta<0 then raise exception 'Insufficient stars'; end if;
  update public.tg_profiles set stars=stars+v_delta where id=v_target.id returning * into v_target;
  insert into public.tg_star_ledger(user_id,delta,reason,actor_id) values(v_target.id,v_delta,v_reason,p_actor);
  insert into public.tg_audit_logs(actor_id,target_id,action,details) values(p_actor,v_target.id,p_action,jsonb_build_object('delta',v_delta,'reason',v_reason));
  return jsonb_build_object('username',v_target.username,'stars',v_target.stars);
 elsif p_action in ('freeze_user','unfreeze_user','soft_delete_user') then
  v_username:=lower(trim(p_payload->>'username'));select * into v_target from public.tg_profiles where username=v_username for update;
  if not found then raise exception 'User not found'; end if;
  if exists(select 1 from auth.users u where u.id=v_target.id and u.raw_app_meta_data->>'topgram_role'='owner') then raise exception 'Owner account protected'; end if;
  if p_action='freeze_user' then update public.tg_profiles set frozen_at=coalesce(frozen_at,now()) where id=v_target.id;
  elsif p_action='unfreeze_user' then update public.tg_profiles set frozen_at=null where id=v_target.id;
  else update public.tg_profiles set deleted_at=coalesce(deleted_at,now()) where id=v_target.id; end if;
  insert into public.tg_audit_logs(actor_id,target_id,action,details) values(p_actor,v_target.id,p_action,jsonb_build_object('username',v_target.username));
  return jsonb_build_object('username',v_target.username,'action',p_action);
 elsif p_action='assign_collectible_username' then
  if v_role<>'owner' then raise exception 'Owner role required'; end if;
  v_username:=lower(trim(p_payload->>'username'));v_user_id:=(p_payload->>'user_id')::uuid;
  if v_username !~ '^[a-zA-Z0-9_]{5,32}$' then raise exception 'Invalid collectible username'; end if;
  if not exists(select 1 from public.tg_profiles where id=v_user_id and deleted_at is null) then raise exception 'Target user not found'; end if;
  insert into public.tg_collectible_usernames(username,owner_id,assigned_at) values(v_username,v_user_id,now())
  on conflict(username) do update set owner_id=excluded.owner_id,assigned_at=now();
  insert into public.tg_audit_logs(actor_id,target_id,action,details) values(p_actor,v_user_id,p_action,jsonb_build_object('username',v_username));
  return jsonb_build_object('username',v_username,'user_id',v_user_id);
 elsif p_action='create_gift' then
  v_gift_id:=gen_random_uuid();
  insert into public.tg_gift_catalog(id,name,description,image_url,total_supply,status)
  values(v_gift_id,left(trim(p_payload->>'name'),80),left(coalesce(p_payload->>'description',''),500),nullif(trim(p_payload->>'image_url'),''),(p_payload->>'total_supply')::integer,'draft');
  insert into public.tg_audit_logs(actor_id,action,details) values(p_actor,p_action,jsonb_build_object('gift_id',v_gift_id));
  return jsonb_build_object('gift_id',v_gift_id,'status','draft');
 elsif p_action='publish_gift' then
  v_gift_id:=(p_payload->>'gift_id')::uuid;
  update public.tg_gift_catalog set status='active' where id=v_gift_id and status='draft' and issued_count<total_supply returning * into v_gift;
  if not found then raise exception 'Draft gift not found'; end if;
  insert into public.tg_audit_logs(actor_id,action,details) values(p_actor,p_action,jsonb_build_object('gift_id',v_gift_id));
  return jsonb_build_object('gift_id',v_gift_id,'status','active');
 elsif p_action='issue_gift' then
  v_gift_id:=(p_payload->>'gift_id')::uuid;v_username:=lower(trim(p_payload->>'username'));
  select id into v_user_id from public.tg_profiles where username=v_username and deleted_at is null;
  if v_user_id is null then raise exception 'User not found'; end if;
  select * into v_gift from public.tg_gift_catalog where id=v_gift_id for update;
  if not found or v_gift.status<>'active' or v_gift.issued_count>=v_gift.total_supply then raise exception 'Gift unavailable or sold out'; end if;
  v_serial:=v_gift.issued_count+1;
  update public.tg_gift_catalog set issued_count=v_serial,status=case when v_serial>=total_supply then 'sold_out' else status end where id=v_gift_id;
  insert into public.tg_gift_drops(gift_id,user_id,serial_number) values(v_gift_id,v_user_id,v_serial);
  insert into public.tg_audit_logs(actor_id,target_id,action,details) values(p_actor,v_user_id,p_action,jsonb_build_object('gift_id',v_gift_id,'serial_number',v_serial));
  return jsonb_build_object('gift_id',v_gift_id,'username',v_username,'serial_number',v_serial);
 else raise exception 'Unsupported action'; end if;
end;$$;
revoke all on function private.tg_admin_action(uuid,text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.tg_admin_action(p_actor uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_role text;
begin
 select u.raw_app_meta_data->>'topgram_role' into v_role from auth.users u where u.id=p_actor;
 if coalesce(v_role,'') not in ('owner','admin') then raise exception 'Not authorized'; end if;
 return private.tg_admin_action(p_actor,p_action,p_payload);
end;$$;
revoke all on function public.tg_admin_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.tg_admin_action(uuid,text,jsonb) to service_role;
