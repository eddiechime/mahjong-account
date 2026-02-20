// --- 1. 唯一初始化：防止 declared 报错 ---
const CLOUD_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const CLOUD_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const db = window.supabase.createClient(CLOUD_URL, CLOUD_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";
let currentPlayers = [];

// 100个精选头像
const allAvatars = ['👾','🕹️','📟','💿','🌈','🛹','🥤','🍕','🍟','🍔','🐱','🐶','🦊','🦁','🐯','🐼','🐻','🐨','🐰','🐸','👻','💀','👽','🤖','🎃','🦾','🧠','👓','🎩','🎭','🎨','🎬','🎤','🎧','🎸','🎹','🥁','🎷','🎺','🧧','💰','💎','🔮','🧿','🏮','🎴','🧪','🧬','🔭','🛸','🚀','🛰️','🪐','🌌','🌋','🍀','🍄','🌵','🌴','🐉','🐲','🦖','🐢','🐍','🐙','🦑','🦞','🦐','🐚','🍣','🍜','🥟','🍱','🍵','🍺','🍷','🍹','🍦','🍩','🍭','🍓','🥑','🥦','🌶️','🌽','🍿','🍡','🥞','🥨'];

// --- 2. 挂载全局函数 (解决 startNewRoom is not a function) ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        currentRoom = roomFromUrl;
        checkName();
    }
};

window.startNewRoom = function() {
    currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

window.joinExistingRoom = function() {
    const val = document.getElementById('roomInput').value.trim();
    if (val.length !== 4) return alert("请输入4位房号");
    currentRoom = val;
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

function checkName() {
    if (!myName) document.getElementById('nameModal').classList.remove('hidden');
    else enterBattle();
}

window.saveNameAndStart = function() {
    const val = document.getElementById('userInput').value.trim();
    if (!val) return alert("请输入名字");
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

// --- 3. 核心：联机同步与监听 ---
async function enterBattle() {
    try {
        // 强制获取最新数据，解决“刷新没人”
        let { data } = await db.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        let players = data ? (data.player_data || []) : [];
        let history = data ? (data.history_data || []) : [];

        if (!players.find(p => p.name === myName)) {
            players.push({ name: myName, score: 0, avatar: '🀄️' });
            await db.from('scores').upsert({ text: currentRoom, player_data: players, history_data: history });
        }

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 140, height: 140 });

        renderUI(players, history);
        
        // 开启全频道监听：解决“别人加入不刷新”
        db.channel(`room-${currentRoom}`).on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => { if(payload.new) renderUI(payload.new.player_data, payload.new.history_data); }
        ).subscribe();
    } catch (e) { alert("进入失败: " + e.message); }
}

function renderUI(players, history) {
    currentPlayers = players;
    document.getElementById('userCount').innerText = players.length;
    document.getElementById('roomInfoContainer').className = (players.length >= 4) ? "room-info-edge" : "room-info-center";

    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div style="display:flex; align-items:center" onclick="window.toggleBox('${p.name}')">
                <div class="avatar-circle" style="width:60px; height:60px; background:#333; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:30px; margin-right:15px;" onclick="event.stopPropagation(); window.changeAvatar('${p.name}')">
                    ${p.avatar || '👤'}
                </div>
                <div style="flex:1">
                    <div style="font-size:14px; opacity:0.6">${p.name}</div>
                    <div class="p-score" style="font-size:38px; font-weight:900;">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}" style="display:none; flex-direction:column; gap:10px; margin-top:10px; padding:15px; background:rgba(255,255,255,0.1); border-radius:10px;">
                <input type="number" id="in-${p.name}" placeholder="金额" inputmode="numeric" style="width:100%; padding:12px; background:#fff; color:#000; border:none; border-radius:8px; font-size:20px;">
                <button onclick="window.quickPay('${p.name}')" style="width:100%; padding:12px; background:#ffeb3b; color:#000; border:none; border-radius:8px; font-weight:900;">确认转账</button>
            </div>
        </div>
    `).join('');
}

window.toggleBox = function(name) {
    if (name === myName) return;
    const box = document.getElementById(`box-${name}`);
    const isShow = box.style.display === 'flex';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    box.style.display = isShow ? 'none' : 'flex';
};

// --- 4. 重点：转账前重新同步数据，防平行时空 ---
window.quickPay = async function(target) {
    const inputEl = document.getElementById(`in-${target}`);
    const pts = parseInt(inputEl.value);
    if (!pts || pts <= 0) return;

    let { data } = await db.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === target) p.score += pts;
        return p;
    });
    let history = data.history_data || [];
    history.push({ from: myName, to: target, pts: pts, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

    await db.from('scores').update({ player_data: players, history_data: history }).eq('text', currentRoom);
    inputEl.value = "";
    document.getElementById(`box-${target}`).style.display = 'none';
};

window.changeAvatar = async function(name) {
    if (name !== myName) return;
    const next = allAvatars[Math.floor(Math.random()*allAvatars.length)];
    const ps = currentPlayers.map(p => { if(p.name===myName) p.avatar=next; return p; });
    await db.from('scores').update({ player_data: ps }).eq('text', currentRoom);
};
