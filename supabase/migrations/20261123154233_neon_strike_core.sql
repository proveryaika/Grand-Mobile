-- NEON STRIKE core schema
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create sequence if not exists public.player_id_seq start 100001;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,player_id bigint not null unique default nextval('public.player_id_seq'),nickname text not null default 'Новичок',role text not null default 'player' check(role in('player','admin','owner')),gold bigint not null default 0 check(gold>=0),verified_admin boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.inventory(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,item_name text not null,rarity text not null default 'Обычный',created_at timestamptz not null default now());
create table if not exists public.market_listings(id uuid primary key default gen_random_uuid(),seller_id uuid references public.profiles(id) on delete set null,item_name text not null,price_gold bigint not null default 0 check(price_gold>=0),stock_remaining bigint,status text not null default 'active' check(status in('active','sold_out','removed')),created_at timestamptz not null default now());
create table if not exists public.game_logs(id bigint generated always as identity primary key,actor_id uuid references public.profiles(id) on delete set null,target_id uuid references public.profiles(id) on delete set null,action text not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table if not exists public.case_opens(id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,opened_on date not null default current_date,created_at timestamptz not null default now(),unique(user_id,opened_on));
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in('owner','admin')); $$;
revoke all on function private.is_admin() from public; grant execute on function private.is_admin() to authenticated;
alter table public.profiles enable row level security; alter table public.inventory enable row level security; alter table public.market_listings enable row level security; alter table public.game_logs enable row level security; alter table public.case_opens enable row level security;
create policy "profile owner or admin read" on public.profiles for select to authenticated using(id=(select auth.uid()) or private.is_admin());
create policy "profile owner updates nickname" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy "inventory owner or admin read" on public.inventory for select to authenticated using(user_id=(select auth.uid()) or private.is_admin());
create policy "active market listings readable" on public.market_listings for select to authenticated using(status='active' or private.is_admin());
revoke all on public.profiles,public.inventory,public.market_listings,public.game_logs,public.case_opens from anon,authenticated;
grant select on public.profiles,public.inventory,public.market_listings to authenticated; grant update(nickname) on public.profiles to authenticated;
create or replace function private.sync_profile_from_auth() returns trigger language plpgsql security definer set search_path='' as $$
declare v_role text:='player'; begin
if lower(coalesce(new.email,''))='maks521488vrn@mail.ru' and new.email_confirmed_at is not null then v_role:='owner'; end if;
insert into public.profiles(id,nickname,role,verified_admin) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(coalesce(new.email,'player'),'@',1)),v_role,v_role='owner')
on conflict(id) do update set role=case when excluded.role='owner' then 'owner' else public.profiles.role end,verified_admin=case when excluded.role='owner' then true else public.profiles.verified_admin end; return new; end; $$;
revoke all on function private.sync_profile_from_auth() from public;
create trigger on_auth_user_profile_created after insert or update of email,email_confirmed_at on auth.users for each row execute function private.sync_profile_from_auth();
create or replace function private.open_starter_case() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_roll numeric;v_name text;v_rarity text; begin
if v_uid is null then raise exception 'Необходим вход';end if; insert into public.case_opens(user_id) values(v_uid); v_roll:=random();
if v_roll<0.70 then v_name:=(array['Граффити: Импульс','Стикер: Пиксель','Брелок: Неон'])[1+floor(random()*3)::int];v_rarity:='Обычный';
elsif v_roll<0.95 then v_name:=(array['Стикер: Турбо','Брелок: Вольт'])[1+floor(random()*2)::int];v_rarity:='Редкий';
else v_name:='Анимация профиля: Разряд';v_rarity:='Эпический';end if;
insert into public.inventory(user_id,item_name,rarity) values(v_uid,v_name,v_rarity);
insert into public.game_logs(actor_id,target_id,action,details) values(v_uid,v_uid,'case_open',jsonb_build_object('item',v_name,'rarity',v_rarity));
return jsonb_build_object('item_name',v_name,'rarity',v_rarity);
exception when unique_violation then raise exception 'Бесплатный контейнер уже открыт сегодня';end;$$;
create or replace function private.admin_grant_gold(target_player_id bigint,amount bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_target uuid;begin if not private.is_admin() then raise exception 'Недостаточно прав';end if;if amount<1 or amount>100000 then raise exception 'Недопустимое количество';end if;
select id into v_target from public.profiles where player_id=target_player_id;if v_target is null then raise exception 'Игрок не найден';end if;
update public.profiles set gold=gold+amount where id=v_target;insert into public.game_logs(actor_id,target_id,action,details) values(auth.uid(),v_target,'gold_grant',jsonb_build_object('amount',amount));return jsonb_build_object('message','Голда выдана');end;$$;
create or replace function private.admin_get_player(target_player_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;begin if not private.is_admin() then raise exception 'Недостаточно прав';end if;
select jsonb_build_object('profile',to_jsonb(p),'inventory',coalesce((select jsonb_agg(to_jsonb(i)) from public.inventory i where i.user_id=p.id),'[]'::jsonb)) into v_result from public.profiles p where p.player_id=target_player_id;
if v_result is null then raise exception 'Игрок не найден';end if;return v_result;end;$$;
create or replace function private.admin_get_logs(target_player_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_target uuid;v_result jsonb;begin if not private.is_admin() then raise exception 'Недостаточно прав';end if;select id into v_target from public.profiles where player_id=target_player_id;if v_target is null then raise exception 'Игрок не найден';end if;
select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc),'[]'::jsonb) into v_result from(select * from public.game_logs where target_id=v_target order by created_at desc limit 100)l;return v_result;end;$$;
create or replace function private.admin_publish_cosmetic(p_name text,p_price bigint,p_stock bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;begin if not private.is_admin() then raise exception 'Недостаточно прав';end if;if length(trim(p_name))<2 or p_price<0 or(p_stock is not null and p_stock<1)then raise exception 'Проверь поля';end if;
insert into public.market_listings(seller_id,item_name,price_gold,stock_remaining) values(auth.uid(),trim(p_name),p_price,p_stock) returning id into v_id;
insert into public.game_logs(actor_id,action,details) values(auth.uid(),'market_publish',jsonb_build_object('listing_id',v_id,'name',p_name,'price',p_price,'stock',p_stock));return jsonb_build_object('id',v_id);end;$$;
grant execute on function private.open_starter_case() to authenticated; grant execute on function private.admin_grant_gold(bigint,bigint) to authenticated; grant execute on function private.admin_get_player(bigint) to authenticated; grant execute on function private.admin_get_logs(bigint) to authenticated; grant execute on function private.admin_publish_cosmetic(text,bigint,bigint) to authenticated;
create or replace function public.open_starter_case() returns jsonb language sql security invoker set search_path='' as $$ select private.open_starter_case(); $$;
create or replace function public.admin_grant_gold(target_player_id bigint,amount bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_grant_gold(target_player_id,amount); $$;
create or replace function public.admin_get_player(target_player_id bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_get_player(target_player_id); $$;
create or replace function public.admin_get_logs(target_player_id bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_get_logs(target_player_id); $$;
create or replace function public.admin_publish_cosmetic(p_name text,p_price bigint,p_stock bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_publish_cosmetic(p_name,p_price,p_stock); $$;
revoke all on function public.open_starter_case() from public; revoke all on function public.admin_grant_gold(bigint,bigint) from public; revoke all on function public.admin_get_player(bigint) from public; revoke all on function public.admin_get_logs(bigint) from public; revoke all on function public.admin_publish_cosmetic(text,bigint,bigint) from public;
grant execute on function public.open_starter_case() to authenticated; grant execute on function public.admin_grant_gold(bigint,bigint) to authenticated; grant execute on function public.admin_get_player(bigint) to authenticated; grant execute on function public.admin_get_logs(bigint) to authenticated; grant execute on function public.admin_publish_cosmetic(text,bigint,bigint) to authenticated;
