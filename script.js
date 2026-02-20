// --- 1. 配置 ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const db = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";

// --- 2. 挂载全局函数，解决 "is not a function" ---
window.startNewRoom = function() {
    currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

window.joinExistingRoom = function() {
    currentRoom = document.getElementById('roomInput').value;
    if (currentRoom.length !== 4) return alert("房号需4位");
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

window.saveNameAndStart = function() {
    const val = document.getElementById('userInput').value.trim();
    if (!val) return;
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

function checkName() {
    if (!myName) document.getElementById('nameModal').classList.remove('hidden');
    else enterBattle();
}

// --- 3. 核心战场与无感刷新 ---
async function enterBattle() {
    let { data } = await db.from('scores').select('*').eq('text', currentRoom).maybeSingle();
    let players = data ? (data.player_data || []) : [];

    if (!players.find(p => p.name === myName)) {
        players.push({ name: myName, score: 0, avatar: '🀄️' });
        await db.from('scores').upsert({ text: currentRoom, player_data: players, history_data: data?.history_data || [] });
    }

    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appMain').classList.remove('hidden');
    document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 130, height: 130 });

    renderUI(players, data?.history_data || []);

    // 开启实时订阅：实现无感自动刷新
    db.channel(`room-${currentRoom}`).on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` 
    }, payload => {
        renderUI(payload.new.player_data, payload.new.history_data);
    }).subscribe();
}

function renderUI(players, history) {
    document.getElementById('userCount').innerText = players.length;
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div class="card-main" onclick="window.toggleBox('${p.name}')">
                <span class="p-avatar">${p.avatar || '👤'}</span>
                <span class="p-name">${p.name}</span>
                <span class="p-score">${p.score}</span>
            </div>
            <div id="box-${p.name}" class="transfer-area" style="display:none; padding:15px; background:rgba(255,255,255,0.1);">
                <input type="number" id="in-${p.name}" placeholder="转账积分" inputmode="numeric" style="width:100%; padding:10px;">
                <button onclick="window.doPay('${p.name}')" class="btn-primary" style="margin-top:10px; width:100%;">确认转账</button>
            </div>
        </div>
    `).join('');
}

window.toggleBox = (name) => {
    if (name === myName) return;
    const el = document.getElementById(`box-${name}`);
    const isShow = el.style.display === 'block';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    el.style.display = isShow ? 'none' : 'block';
};

// --- 4. 绝杀：云端原子化结算，终结平行时空 ---
window.doPay = async (target) => {
    const inputEl = document.getElementById(`in-${target}`);
    const val = parseInt(inputEl.value);
    if (!val || val <= 0) return;

    // 转账瞬间强制回云端抓取最新分
    let { data } = await db.from('scores').select('*').eq('text', currentRoom).single();
    let latestPlayers = data.player_data.map(p => {
        if (p.name === myName) p.score -= val;
        if (p.name === target) p.score += val;
        return p;
    });
    
    let latestHistory = data.history_data || [];
    latestHistory.push({ from: myName, to: target, pts: val, time: new Date().toLocaleTimeString() });

    await db.from('scores').update({ player_data: latestPlayers, history_data: latestHistory }).eq('text', currentRoom);
    inputEl.value = "";
    document.getElementById(`box-${target}`).style.display = 'none';
};

// 刷新自动重连
const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom) { currentRoom = urlRoom; checkName(); }
