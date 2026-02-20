const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";
let currentPlayers = [];

const allAvatars = ['👾','🕹️','📟','💿','🌈','🛹','🥤','🍕','🍟','🍔','🐱','🐶','🦊','🦁','🐯','🐼','🐻','🐨','🐰','🐸','👻','💀','👽','🤖','🎃','🦾','🧠','👓','🎩','🎭','🎨','🎬','🎤','🎧','🎸','🎹','🥁','🎷','🎺','🎳','🎮','🎯','🎲','🎰','🎱','🧩','🧸','🧧','💰','💎','🔮','🧿','🏮','🎴','🧪','🧬','🔭','🛸','🚀','🛰️','🪐','🌌','🌋','🍀','🍄','🌵','🌴','🐉','🐲','Rex','🦖','🐢','🐍','🐙','🦑','🦞','🦐','🐚','🍣','🍜','🥟','🍱','🍵','🍺','🍷','🍹','🍦','🍩','🍭','🍓','🥑','🥦','🌶️','🌽','🍿','🍡','🥞','🥨'];

window.startNewRoom = function() {
    currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
    checkName();
};

window.joinExistingRoom = function() {
    const val = document.getElementById('roomInput').value.trim();
    if (val.length !== 4) return alert("请输入4位房号");
    currentRoom = val;
    checkName();
};

function checkName() {
    if (!myName) document.getElementById('nameModal').classList.remove('hidden');
    else enterBattle();
}

window.saveNameAndStart = function() {
    const val = document.getElementById('userInput').value.trim();
    if (!val) return alert("请赐名");
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

async function enterBattle() {
    try {
        let { data, error } = await sb.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        
        // 核心修复：如果 data 为空，手动初始化一个空对象
        let players = data ? (data.player_data || []) : [];
        let history = data ? (data.history_data || []) : [];

        if (!players.find(p => p.name === myName)) {
            players.push({ name: myName, score: 0, avatar: '🀄️' });
            // 使用 upsert 确保新房间创建成功
            await sb.from('scores').upsert({ text: currentRoom, player_data: players, history_data: history });
        }

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), {
            text: window.location.origin + window.location.pathname + "?room=" + currentRoom,
            width: 140, height: 140
        });

        renderUI(players, history);
        
        sb.channel('updates').on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => {
                if(payload.new) renderUI(payload.new.player_data, payload.new.history_data);
            }
        ).subscribe();

    } catch (e) { alert("进场失败: " + e.message); }
}

function renderUI(players, history) {
    if(!players) return; // 二重防护
    currentPlayers = players;
    document.getElementById('userCount').innerText = players.length;
    document.getElementById('roomInfoContainer').className = (players.length >= 4) ? "room-info-edge" : "room-info-center";

    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div style="display:flex; align-items:center" onclick="window.toggleBox('${p.name}')">
                <div class="avatar-circle" onclick="event.stopPropagation(); window.changeAvatar('${p.name}')">${p.avatar || '👤'}</div>
                <div style="flex:1">
                    <div style="font-size:14px; opacity:0.6">${p.name}</div>
                    <div class="p-score">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}" style="display:none">
                <input type="number" class="quick-input" id="in-${p.name}" placeholder="输入积分..." inputmode="numeric">
                <button class="quick-send-btn" onclick="window.quickPay('${p.name}')">转账</button>
            </div>
        </div>
    `).join('');

    document.getElementById('logList').innerHTML = (history || []).slice().reverse().map(h => `
        <div style="padding:8px; font-size:13px; border-bottom:1px solid #333; color:#ccc">
            <span style="color:var(--gold)">${h.time}</span> | ${h.from} ➔ ${h.to} [<b>${h.pts}</b>]
        </div>
    `).join('');
}

window.toggleBox = function(name) {
    if (name === myName) return;
    const box = document.getElementById(`box-${name}`);
    const isShow = box.style.display === 'flex';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    box.style.display = isShow ? 'none' : 'flex';
    if(!isShow) setTimeout(() => document.getElementById(`in-${name}`).focus(), 100);
};

window.quickPay = async function(target) {
    const inputEl = document.getElementById(`in-${target}`);
    const pts = parseInt(inputEl.value);
    if (!pts || pts <= 0) return;

    let { data } = await sb.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === target) p.score += pts;
        return p;
    });
    let history = data.history_data || [];
    history.push({ from: myName, to: target, pts: pts, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

    await sb.from('scores').update({ player_data: players, history_data: history }).eq('text', currentRoom);
    inputEl.value = "";
};

window.changeAvatar = async function(name) {
    if (name !== myName) return;
    const next = allAvatars[Math.floor(Math.random()*allAvatars.length)];
    const ps = currentPlayers.map(p => { if(p.name===myName) p.avatar=next; return p; });
    await sb.from('scores').update({ player_data: ps }).eq('text', currentRoom);
};
