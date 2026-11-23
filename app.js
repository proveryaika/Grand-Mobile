import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const supabase=createClient('https://wcaribszxpmiqwbzgtke.supabase.co','sb_publishable_Huac5EmoI5XUzA-xi3Tw2A_TQpfBGXT');
let user=null,currentProfile=null;
const $=id=>document.getElementById(id);
const toast=m=>{const e=$('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000)};
const err=e=>e?.message||'Не удалось выполнить действие';
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showAuth(){$('auth-screen').classList.remove('hidden');$('game-shell').classList.add('hidden')}
function showGame(){$('auth-screen').classList.add('hidden');$('game-shell').classList.remove('hidden')}
async function load(){
 const {data,error}=await supabase.from('profiles').select('id,player_id,nickname,role,gold,verified_admin').eq('id',user.id).single();if(error)throw error;currentProfile=data;
 $('player-name').textContent=data.nickname||user.email?.split('@')[0]||'Игрок';$('player-id').textContent='ID: '+data.player_id;$('gold-balance').textContent=data.gold;
 $('verified-badge').classList.toggle('hidden',!data.verified_admin);$('admin-nav').classList.toggle('hidden',!['owner','admin'].includes(data.role));
 showGame();await inventory();await market();
}
async function inventory(){
 const {data,error}=await supabase.from('inventory').select('id,item_name,rarity').eq('user_id',user.id).order('created_at',{ascending:false});if(error)return;
 $('item-count').textContent=data.length;
 $('inventory-grid').innerHTML=data.length?data.map(x=>'<article class="item-card"><div class="item-art">◇</div><h3>'+escapeHtml(x.item_name)+'</h3><small>'+escapeHtml(x.rarity)+'</small><div style="margin-top:12px"><button class="secondary" data-sell="'+x.id+'">Выставить на маркет</button></div></article>').join(''):'<p class="empty-state">Инвентарь пока пуст.</p>';
 document.querySelectorAll('[data-sell]').forEach(b=>b.onclick=async()=>{const price=Number(prompt('Укажи цену в голде (0 — бесплатно):','100'));if(!Number.isSafeInteger(price)||price<0){toast('Некорректная цена');return;}const {error}=await supabase.rpc('list_inventory_item',{p_inventory_id:b.dataset.sell,p_price:price});if(error){toast(err(error));return;}toast('Предмет выставлен на маркет');await inventory();await market();});
}
async function market(){
 const {data,error}=await supabase.from('market_listings').select('id,item_name,item_rarity,price_gold,stock_remaining').eq('status','active').limit(50);
 if(error){$('market-grid').innerHTML='<p class="empty-state">Маркет ещё не настроен.</p>';return;}
 $('market-grid').innerHTML=data.length?data.map(x=>'<article class="item-card"><div class="item-art">◇</div><h3>'+escapeHtml(x.item_name)+'</h3><small>'+escapeHtml(x.item_rarity)+' · '+x.price_gold+' ◆ · Тираж: '+(x.stock_remaining===null?'∞':x.stock_remaining)+'</small><div style="margin-top:12px"><button class="primary" data-buy="'+x.id+'">Купить</button></div></article>').join(''):'<p class="empty-state">Пока нет предложений.</p>';
 $('listing-count').textContent=data.length;
 document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{if(!confirm('Купить этот предмет за голду?'))return;const {data,error}=await supabase.rpc('buy_market_listing',{p_listing_id:b.dataset.buy});if(error){toast(err(error));return;}toast('Предмет куплен: '+data.item_name);await load();});
}
$('email-form').addEventListener('submit',async e=>{e.preventDefault();const {error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)toast(err(error));});
$('email-signup').onclick=async()=>{const {error}=await supabase.auth.signUp({email:$('email').value.trim(),password:$('password').value,options:{emailRedirectTo:location.origin}});toast(error?err(error):'Проверь почту и подтверди адрес.');};
$('google-login').onclick=async()=>{const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}});if(error)toast(err(error));};
$('vk-login').onclick=()=>toast('VK ID ещё не активирован: нужны OAuth credentials VK и настройка провайдера.');
$('logout').onclick=async()=>{await supabase.auth.signOut();user=null;currentProfile=null;showAuth();};
$('open-case').onclick=async()=>{const {data,error}=await supabase.rpc('open_starter_case');if(error){toast(err(error));return;}$('drop-result').classList.remove('hidden');$('drop-result').textContent='Получено: '+data.item_name+' · '+data.rarity;await inventory();};
$('refresh-market').onclick=market;
function navigate(page){document.querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));}
document.querySelectorAll('.nav-button[data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
document.querySelectorAll('[data-admin-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.admin-panel').forEach(x=>x.classList.toggle('active',x.id==='admin-'+b.dataset.adminTab));});
$('grant-form').onsubmit=async e=>{e.preventDefault();const {data,error}=await supabase.rpc('admin_grant_gold',{target_player_id:Number($('grant-player-id').value),amount:Number($('grant-amount').value)});$('admin-message').textContent=error?err(error):(data?.message||'Голда выдана.');};
$('player-search').onsubmit=async e=>{
 e.preventDefault();const id=Number($('search-player-id').value);
 const {data,error}=await supabase.rpc('admin_get_player',{target_player_id:id});
 if(error){$('player-result').textContent=err(error);return;}
 const p=data.profile,items=data.inventory||[];
 let block='<article class="stat-card"><b>'+escapeHtml(p.nickname)+'</b><p>ID: '+p.player_id+' · Роль: '+p.role+' · Голда: '+p.gold+'</p><p>Инвентарь: '+items.length+' предметов</p><ul>'+items.map(x=>'<li>'+escapeHtml(x.item_name)+' — '+escapeHtml(x.rarity)+'</li>').join('')+'</ul></article>';
 if(currentProfile?.role==='owner'&&p.role!=='owner')block+='<div class="admin-form" style="margin-top:12px"><button class="secondary" id="toggle-admin">'+(p.role==='admin'?'Снять админку':'Выдать админку')+'</button><button class="secondary" id="delete-account">Удалить аккаунт</button></div>';
 $('player-result').innerHTML=block;
 const toggle=$('toggle-admin');if(toggle)toggle.onclick=async()=>{const {error}=await supabase.rpc('owner_set_admin',{target_player_id:id,make_admin:p.role!=='admin'});if(error){toast(err(error));return;}toast('Роль обновлена');$('player-search').requestSubmit();};
 const del=$('delete-account');if(del)del.onclick=async()=>{if(!confirm('Удалить аккаунт игрока '+id+'? Это действие нельзя отменить.'))return;const {error}=await supabase.rpc('owner_delete_player',{target_player_id:id});if(error){toast(err(error));return;}toast('Аккаунт удалён');$('player-result').textContent='Аккаунт удалён.';};
};
$('logs-search').onsubmit=async e=>{e.preventDefault();const {data,error}=await supabase.rpc('admin_get_logs',{target_player_id:Number($('logs-player-id').value)});$('logs-result').textContent=error?err(error):JSON.stringify(data,null,2);};
$('catalog-form').onsubmit=async e=>{e.preventDefault();const {error}=await supabase.rpc('admin_publish_cosmetic',{p_name:$('item-name').value.trim(),p_price:Number($('item-price').value),p_stock:$('item-stock').value==='infinite'?null:100});$('admin-message').textContent=error?err(error):'Предмет опубликован.';if(!error)market();};
$('listing-edit-form').onsubmit=async e=>{e.preventDefault();const stockText=$('edit-listing-stock').value.trim();const stock=stockText===''||stockText==='∞'?null:Number(stockText);if(stock!==null&&(!Number.isSafeInteger(stock)||stock<0)){toast('Некорректный тираж');return;}const {error}=await supabase.rpc('admin_update_listing',{p_listing_id:$('edit-listing-id').value.trim(),p_price:Number($('edit-listing-price').value),p_stock:stock});$('admin-message').textContent=error?err(error):'Лот обновлён.';if(!error)market();};
supabase.auth.onAuthStateChange(async(_event,session)=>{if(session?.user){user=session.user;try{await load()}catch(e){toast('Ошибка профиля: '+err(e))}}else{user=null;currentProfile=null;showAuth();}});
const {data:{session}}=await supabase.auth.getSession();if(session?.user){user=session.user;try{await load()}catch(e){toast(err(e));}}
