-- Market trading and owner-only account controls
alter table public.market_listings add column if not exists item_rarity text not null default 'Обычный';
create or replace function private.is_owner() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='owner'); $$;
revoke all on function private.is_owner() from public; grant execute on function private.is_owner() to authenticated;
create or replace function private.owner_set_admin(target_player_id bigint,make_admin boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_target uuid; begin
if not private.is_owner() then raise exception 'Только владелец может менять права администраторов'; end if;
select id into v_target from public.profiles where player_id=target_player_id;
if v_target is null then raise exception 'Игрок не найден'; end if;
if v_target=auth.uid() then raise exception 'Нельзя менять собственную роль владельца'; end if;
update public.profiles set role=case when make_admin then 'admin' else 'player' end,verified_admin=make_admin where id=v_target;
insert into public.game_logs(actor_id,target_id,action,details) values(auth.uid(),v_target,'role_change',jsonb_build_object('role',case when make_admin then 'admin' else 'player' end));
return jsonb_build_object('success',true); end; $$;
create or replace function private.owner_delete_player(target_player_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_target uuid; begin
if not private.is_owner() then raise exception 'Только владелец может удалять аккаунты'; end if;
select id into v_target from public.profiles where player_id=target_player_id;
if v_target is null then raise exception 'Игрок не найден'; end if;
if v_target=auth.uid() then raise exception 'Нельзя удалить аккаунт владельца из панели'; end if;
delete from auth.sessions where user_id=v_target; delete from auth.users where id=v_target;
insert into public.game_logs(actor_id,action,details) values(auth.uid(),'account_delete',jsonb_build_object('player_id',target_player_id));
return jsonb_build_object('success',true); end; $$;
create or replace function private.admin_update_listing(p_listing_id uuid,p_price bigint,p_stock bigint) returns jsonb language plpgsql security definer set search_path='' as $$
begin
if not private.is_admin() then raise exception 'Недостаточно прав'; end if;
if p_price<0 or(p_stock is not null and p_stock<0)then raise exception 'Цена и тираж не могут быть отрицательными';end if;
update public.market_listings set price_gold=p_price,stock_remaining=p_stock,status=case when p_stock=0 then 'sold_out' else 'active' end where id=p_listing_id;
if not found then raise exception 'Лот не найден';end if;
insert into public.game_logs(actor_id,action,details) values(auth.uid(),'market_update',jsonb_build_object('listing_id',p_listing_id,'price',p_price,'stock',p_stock));return jsonb_build_object('success',true);end; $$;
create or replace function private.list_inventory_item(p_inventory_id uuid,p_price bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item public.inventory%rowtype;v_listing uuid;begin
if auth.uid() is null then raise exception 'Необходим вход';end if;if p_price<0 then raise exception 'Цена не может быть отрицательной';end if;
select * into v_item from public.inventory where id=p_inventory_id and user_id=auth.uid() for update;
if not found then raise exception 'Предмет не найден в вашем инвентаре';end if;
delete from public.inventory where id=p_inventory_id;
insert into public.market_listings(seller_id,item_name,item_rarity,price_gold,stock_remaining) values(auth.uid(),v_item.item_name,v_item.rarity,p_price,1) returning id into v_listing;
insert into public.game_logs(actor_id,action,details) values(auth.uid(),'market_list',jsonb_build_object('listing_id',v_listing,'item',v_item.item_name));return jsonb_build_object('listing_id',v_listing);end; $$;
create or replace function private.buy_market_listing(p_listing_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_listing public.market_listings%rowtype;v_gold bigint;begin
if auth.uid() is null then raise exception 'Необходим вход';end if;
select * into v_listing from public.market_listings where id=p_listing_id and status='active' for update;
if not found then raise exception 'Лот недоступен';end if;if v_listing.seller_id=auth.uid() then raise exception 'Нельзя купить собственный лот';end if;
select gold into v_gold from public.profiles where id=auth.uid() for update;if v_gold<v_listing.price_gold then raise exception 'Недостаточно голды';end if;
update public.profiles set gold=gold-v_listing.price_gold where id=auth.uid();
if v_listing.seller_id is not null then update public.profiles set gold=gold+v_listing.price_gold where id=v_listing.seller_id;end if;
insert into public.inventory(user_id,item_name,rarity) values(auth.uid(),v_listing.item_name,v_listing.item_rarity);
if v_listing.stock_remaining is not null then update public.market_listings set stock_remaining=stock_remaining-1,status=case when stock_remaining-1=0 then 'sold_out' else 'active' end where id=p_listing_id;end if;
insert into public.game_logs(actor_id,target_id,action,details) values(auth.uid(),v_listing.seller_id,'market_purchase',jsonb_build_object('listing_id',p_listing_id,'item',v_listing.item_name,'price',v_listing.price_gold));
return jsonb_build_object('success',true,'item_name',v_listing.item_name);end; $$;
grant execute on function private.owner_set_admin(bigint,boolean) to authenticated;
grant execute on function private.owner_delete_player(bigint) to authenticated;
grant execute on function private.admin_update_listing(uuid,bigint,bigint) to authenticated;
grant execute on function private.list_inventory_item(uuid,bigint) to authenticated;
grant execute on function private.buy_market_listing(uuid) to authenticated;
create or replace function public.owner_set_admin(target_player_id bigint,make_admin boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.owner_set_admin(target_player_id,make_admin); $$;
create or replace function public.owner_delete_player(target_player_id bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.owner_delete_player(target_player_id); $$;
create or replace function public.admin_update_listing(p_listing_id uuid,p_price bigint,p_stock bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_update_listing(p_listing_id,p_price,p_stock); $$;
create or replace function public.list_inventory_item(p_inventory_id uuid,p_price bigint) returns jsonb language sql security invoker set search_path='' as $$ select private.list_inventory_item(p_inventory_id,p_price); $$;
create or replace function public.buy_market_listing(p_listing_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.buy_market_listing(p_listing_id); $$;
revoke all on function public.owner_set_admin(bigint,boolean) from public; revoke all on function public.owner_delete_player(bigint) from public; revoke all on function public.admin_update_listing(uuid,bigint,bigint) from public; revoke all on function public.list_inventory_item(uuid,bigint) from public; revoke all on function public.buy_market_listing(uuid) from public;
grant execute on function public.owner_set_admin(bigint,boolean) to authenticated; grant execute on function public.owner_delete_player(bigint) to authenticated; grant execute on function public.admin_update_listing(uuid,bigint,bigint) to authenticated; grant execute on function public.list_inventory_item(uuid,bigint) to authenticated; grant execute on function public.buy_market_listing(uuid) to authenticated;