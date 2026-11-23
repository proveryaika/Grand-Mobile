import {createClient} from '@supabase/supabase-js';
import './style.css';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
let db,session,profile,convs=[],active=null,msgs=[],channel;
function render(html){$('#app').innerHTML=html}
async function start(){const r=await db.auth.getSession();session=r.data.session;if(!session)return login();await profileLoad()}
function login(){render(`<main class="center"><section class="panel"><div class="logo">T</div><small>НЕЗАВИСИМЫЙ МЕССЕНДЖЕР</small><h1>TopGram</h1><p>Вход в собственный аккаунт TopGram.</p><form id="login"><label>Электронная почта</label><input id="email" type="email" required placeholder="you@example.com"><button>Получить код</button></form><p id="status"></p><small>Код отправляется самим TopGram на почту, не используется для входа в Telegram.</small></section></main>`);$('#login').onsubmit=async e=>{e.preventDefault();let email=$('#email').value.trim(),s=$('#status');let r=await db.auth.signInWithOtp({email});if(r.error){s.textContent=r.error.message;return}$('#login').innerHTML='<label>Код из письма</label><input id="otp" required inputmode="numeric"><button>Подтвердить вход</button>';$('#login').onsubmit=async ev=>{ev.preventDefault();let v=await db.auth.verifyOtp({email,token:$('#otp').value.trim(),type:'email'});if(v.error)s.textContent=v.error.message;else start()};s.textContent='Код отправлен.'}}
async function profileLoad(){let r=await db.from('tg_profiles').select('*').eq('id',session.user.id).maybeSingle();if(r.error){render('<main class="center">'+esc(r.error.message)+'</main>');return}profile=r.data;if(!profile)return setupProfile();home()}
function setupProfile(){render(`<main class="center"><section class="panel"><div class="logo">T</div><h1>Твой профиль</h1><form id="setup"><label>Username (5–32 символа)</label><input id="username" pattern="[A-Za-z0-9_]{5,32}" required><label>Имя</label><input id="name" maxlength="64" required><button>Продолжить</button></form><p id="status"></p></section></main>`);$('#setup').onsubmit=async e=>{e.preventDefault();let r=await db.from('tg_profiles').insert({id:session.user.id,username:$('#username').value.toLowerCase(),display_name:$('#name').value});if(r.error)$('#status').textContent=r.error.message;else profileLoad()}}
function home(){let admin=['owner','admin'].includes(session.user.app_metadata?.topgram_role);render(`<div class="layout"><aside><header><b>✦ TopGram</b><button id="new">＋</button></header><input id="filter" placeholder="Поиск чатов"><p class="muted">СООБЩЕНИЯ</p><nav id="convs"></nav><footer><b>${esc(profile.display_name)}</b><small>@${esc(profile.username)} · ✦ ${profile.stars}</small>${admin?'<small>ADMIN</small>':''}<button id="logout">Выйти</button></footer></aside><main><header><b id="title">Твои сообщения</b></header><section id="welcome"><h2>Общайся свободно</h2><p>Выбери диалог или начни новый.</p><button id="start">Новый чат</button></section><section id="messages" class="hidden"></section><form id="send" class="hidden"><input id="body" maxlength="4000" placeholder="Написать сообщение…"><button>➤</button></form></main></div><div id="modal"></div>`);if(admin){const b=document.createElement('button');b.id='admin-open';b.className='admin-open';b.textContent='Админ-панель';document.querySelector('.chat header').append(b);b.onclick=adminPanel}$('#logout').onclick=async()=>{await db.auth.signOut();login()};$('#new').onclick=$('#start').onclick=newChat;$('#send').onsubmit=send;$('#filter').oninput=e=>drawConvs(e.target.value);loadConvs()}

async function adminCall(action,payload={}) {
 const {data,error}=await db.functions.invoke('topgram-admin',{body:{action,payload}});
 if(error) throw new Error(error.message||'Ошибка запроса');
 if(data?.error) throw new Error(data.error);
 return data;
}
function adminPanel(){
 const owner=session.user.app_metadata?.topgram_role==='owner',root=$('#modal');
 root.innerHTML=\`<div class="shade admin-shade"><section class="admin-panel">
 <button id="admin-close" class="close">×</button><p class="eyebrow">УПРАВЛЕНИЕ TOPGRAM</p><h2>Админ-панель</h2>
 <div class="admin-grid">
 <section class="admin-card"><h3>Пользователь</h3><div class="admin-line"><input id="admin-username" placeholder="username"><button id="admin-find">Найти</button></div>
 <div id="admin-user" class="admin-result">Введи username для поиска.</div><div class="admin-actions">
 <input id="admin-stars" type="number" min="1" max="1000000000" value="10" placeholder="Количество звёзд"><input id="admin-reason" maxlength="240" placeholder="Причина начисления">
 <button id="admin-add-stars">Начислить звёзды</button><button id="admin-take-stars" class="secondary">Списать звёзды</button>
 <button id="admin-freeze" class="secondary">Заморозить аккаунт</button><button id="admin-unfreeze" class="secondary">Разморозить аккаунт</button>
 <button id="admin-logs" class="secondary">Посмотреть логи</button><button id="admin-delete" class="danger">Пометить аккаунт удалённым</button></div>
 \${owner?\`<hr><h3>Права и коллекционные username</h3><input id="collectible-name" placeholder="Коллекционный username"><button id="collectible-assign">Назначить найденному пользователю</button><button id="admin-role" class="secondary">Выдать / снять права администратора</button>\`:''}
 </section>
 <section class="admin-card"><h3>Коллекционные подарки</h3><label>Название</label><input id="gift-name" maxlength="80" placeholder="Например, Aurora">
 <label>Описание</label><input id="gift-description" maxlength="500" placeholder="Описание подарка">
 <label>Ссылка на изображение (необязательно)</label><input id="gift-image" type="url" placeholder="https://...">
 <label>Количество экземпляров</label><input id="gift-supply" type="number" min="1" max="100000" value="100">
 <button id="gift-create">Создать выпуск (черновик)</button><div id="gift-list" class="gift-list">Загружаем выпуски…</div>
 <p class="tiny">Сначала создаётся черновик. Его нужно отдельно опубликовать; количество экземпляров ограничено.</p></section></div>
 <pre id="admin-status" class="admin-status" aria-live="polite"></pre></section></div>\`;
 $('#admin-close').onclick=()=>root.innerHTML='';
 const say=v=>{$('#admin-status').textContent=typeof v==='string'?v:JSON.stringify(v,null,2)};
 let selected=null;
 async function find(){const username=$('#admin-username').value.trim().toLowerCase();if(!username){say('Введи username.');return}
 try{const r=await adminCall('lookup_user',{username});selected=r.user;$('#admin-user').innerHTML=\`<b>@\${esc(selected.username)}</b><br>\${esc(selected.display_name)}<br>Звёзды: \${selected.stars}<br>Статус: \${selected.deleted_at?'удалён':selected.frozen_at?'заморожен':'активен'}<br><small>ID: \${esc(selected.id)}</small>\`;say('Пользователь найден.')}
 catch(e){selected=null;$('#admin-user').textContent=e.message;say(e.message)}}
 $('#admin-find').onclick=find;$('#admin-add-stars').onclick=()=>changeStars(1);$('#admin-take-stars').onclick=()=>changeStars(-1);
 async function changeStars(sign){if(!selected){say('Сначала найди пользователя.');return}const n=Number($('#admin-stars').value);if(!Number.isSafeInteger(n)||n<1){say('Укажи корректное количество.');return}
 try{const r=await adminCall('grant_stars',{username:selected.username,delta:n*sign,reason:$('#admin-reason').value.trim()||'Admin adjustment'});say(r.result);await find()}catch(e){say(e.message)}}
 $('#admin-freeze').onclick=()=>userAction('freeze_user');$('#admin-unfreeze').onclick=()=>userAction('unfreeze_user');
 $('#admin-delete').onclick=()=>{if(confirm('Пометить аккаунт как удалённый? Профиль будет скрыт, отправка сообщений заблокирована.'))userAction('soft_delete_user')};
 async function userAction(action){if(!selected){say('Сначала найди пользователя.');return}try{const r=await adminCall(action,{username:selected.username});say(r.result);await find()}catch(e){say(e.message)}}
 $('#admin-logs').onclick=async()=>{if(!selected){say('Сначала найди пользователя.');return}try{const r=await adminCall('get_logs',{username:selected.username});say(r.logs)}catch(e){say(e.message)}};
 if(owner){
  $('#collectible-assign').onclick=async()=>{if(!selected){say('Сначала найди пользователя.');return}try{const r=await adminCall('assign_collectible_username',{username:$('#collectible-name').value.trim(),user_id:selected.id});say(r.result)}catch(e){say(e.message)}};
  $('#admin-role').onclick=async()=>{if(!selected){say('Сначала найди пользователя.');return}const enabled=confirm('OK — выдать роль администратора. Отмена — снять роль.');try{say(await adminCall('set_admin_role',{username:selected.username,enabled}))}catch(e){say(e.message)}};
 }
 $('#gift-create').onclick=async()=>{const name=$('#gift-name').value.trim(),total_supply=Number($('#gift-supply').value);if(!name||!Number.isSafeInteger(total_supply)||total_supply<1||total_supply>100000){say('Проверь название и количество.');return}
 try{const r=await adminCall('create_gift',{name,description:$('#gift-description').value.trim(),image_url:$('#gift-image').value.trim(),total_supply});say(r.result);await loadAdminGifts()}catch(e){say(e.message)}};
 async function loadAdminGifts(){const {data,error}=await db.from('tg_gift_catalog').select('id,name,total_supply,issued_count,status').order('created_at',{ascending:false}).limit(50);if(error){$('#gift-list').textContent=error.message;return}
 $('#gift-list').innerHTML=(data||[]).map(g=>\`<div class="gift-item"><b>\${esc(g.name)}</b><small>\${g.issued_count}/\${g.total_supply} · \${esc(g.status)}</small><code>\${g.id}</code><div><button data-publish="\${g.id}" \${g.status!=='draft'?'disabled':''}>Опубликовать</button><button data-issue="\${g.id}" \${g.status!=='active'?'disabled':''}>Выдать пользователю</button></div></div>\`).join('')||'<p class="muted">Пока нет выпусков.</p>';
 $('#gift-list').querySelectorAll('[data-publish]').forEach(b=>b.onclick=async()=>{try{const r=await adminCall('publish_gift',{gift_id:b.dataset.publish});say(r.result);await loadAdminGifts()}catch(e){say(e.message)}});
 $('#gift-list').querySelectorAll('[data-issue]').forEach(b=>b.onclick=async()=>{const username=prompt('Username получателя:');if(!username)return;try{const r=await adminCall('issue_gift',{gift_id:b.dataset.issue,username});say(r.result);await loadAdminGifts()}catch(e){say(e.message)}})}
 loadAdminGifts();
}

async function loadConvs(){let r=await db.from('tg_conversation_members').select('conversation_id,tg_conversations(id,kind,title)').eq('user_id',session.user.id);if(r.error)return;convs=(r.data||[]).map(x=>x.tg_conversations).filter(Boolean);drawConvs()}
function drawConvs(q=''){let root=$('#convs');if(!root)return;root.innerHTML=convs.filter(c=>(c.title||'Личный чат').toLowerCase().includes(q.toLowerCase())).map(c=>`<button data-id="${c.id}">${c.kind==='group'?'◎':'◉'} &nbsp; ${esc(c.title||'Личный чат')}</button>`).join('')||'<p class="muted">Пока нет диалогов</p>';root.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openChat(b.dataset.id))}
function newChat(){let root=$('#modal');root.innerHTML=`<div class="shade"><form id="newform" class="panel"><button type="button" id="close">×</button><h2>Новый диалог</h2><label>Username собеседника</label><input id="peer" pattern="[A-Za-z0-9_]{5,32}" required><p id="status"></p><button>Создать</button></form></div>`;$('#close').onclick=()=>root.innerHTML='';$('#newform').onsubmit=async e=>{e.preventDefault();let p=await db.from('tg_profiles').select('id').eq('username',$('#peer').value.toLowerCase()).maybeSingle();if(!p.data){$('#status').textContent='Пользователь не найден';return}if(p.data.id===session.user.id){$('#status').textContent='Это твой username';return}let c=await db.from('tg_conversations').insert({kind:'direct',created_by:session.user.id}).select().single();if(c.error){$('#status').textContent=c.error.message;return}let m=await db.from('tg_conversation_members').insert([{conversation_id:c.data.id,user_id:session.user.id,member_role:'owner'},{conversation_id:c.data.id,user_id:p.data.id}]);if(m.error){$('#status').textContent=m.error.message;return}root.innerHTML='';await loadConvs();openChat(c.data.id)}}
async function openChat(id){let r=await db.from('tg_conversations').select('*').eq('id',id).single();if(r.error)return;active=r.data;$('#title').textContent=active.title||'Личный диалог';$('#welcome').classList.add('hidden');$('#messages').classList.remove('hidden');$('#send').classList.remove('hidden');await loadMessages();if(channel)await db.removeChannel(channel);channel=db.channel('tg-'+id).on('postgres_changes',{event:'INSERT',schema:'public',table:'tg_messages',filter:'conversation_id=eq.'+id},p=>{if(p.new.sender_id!==session.user.id){msgs.push(p.new);drawMessages()}}).subscribe()}
async function loadMessages(){let r=await db.from('tg_messages').select('*').eq('conversation_id',active.id).order('created_at').limit(150);if(r.error){$('#messages').textContent=r.error.message;return}msgs=r.data||[];drawMessages()}
function drawMessages(){$('#messages').innerHTML=msgs.map(m=>`<article class="${m.sender_id===session.user.id?'mine':''}">${esc(m.body)}<small>${new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></article>`).join('');$('#messages').scrollTop=$('#messages').scrollHeight}
async function send(e){e.preventDefault();let body=$('#body').value.trim();if(!body||!active)return;$('#body').value='';let r=await db.from('tg_messages').insert({conversation_id:active.id,sender_id:session.user.id,body}).select().single();if(r.error){$('#body').value=body;alert(r.error.message);return}msgs.push(r.data);drawMessages()}
if(!url||!key)render('<main class="center"><section class="panel"><h1>TopGram</h1><p>Добавь .env по примеру .env.example.</p></section></main>');else{db=createClient(url,key);start()}
