const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const db = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";

// 1. 全局挂载函数
window.startNewRoom = () => {
    currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

window.joinExistingRoom = () => {
    const val = document.getElementById('roomInput').value;
    if (val.length !== 4) return alert("房号需4位");
    currentRoom = val;
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

window.saveNameAndStart = () => {
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

// 2. 实时无感监听
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

    // 二维码包含房间链接
    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 130, height: 130 });

    renderUI(players, data?.history_data || []);

    // 订阅实时频道
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
            <div class="card-main" onclick="window.toggleBox('${p.name}')" style="display:flex; align-items:center; cursor:pointer;">
                <span style="font-size:30px; margin-right:15px;">${p.avatar || '👤'}</span>
                <div style="flex:1">
                    <div style="font-size:14px; opacity:0.7">${p.name}</div>
                    <div style="font-size:32px; font-weight:900;">${p.score}</div>
                </div>
            </div>
            <div id="box-${p.name}" class="transfer-area" style="display:none;">
                <input type="number" id="in-${p.name}" placeholder="转账积分" inputmode="numeric" class="quick-input">
                <button onclick="window.doPay('${p.name}')" class="btn-primary">确认转账</button>
            </div>
        </div>
    `).join('');

    document.getElementById('logList').innerHTML = (history || []).slice().reverse().map(h => `
        <div style="padding:5px; font-size:12px; border-bottom:1px solid #333;">${h.from} ➔ ${h.to} [${h.pts}]</div>
    `).join('');
}

window.toggleBox = (name) => {
    if (name === myName) return;
    const el = document.getElementById(`box-${name}`);
    const isShow = el.style.display === 'block';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    el.style.display = isShow ? 'none' : 'block';
};

// 3. 【绝杀】解决平行时空的核心函数
window.doPay = async (target) => {
    const inputEl = document.getElementById(`in-${target}`);
    const val = parseInt(inputEl.value);
    if (!val || val <= 0) return;

    // 转账瞬间回云端抓最新分，彻底杜绝 Lynn 操作被覆盖
    let { data, error } = await db.from('scores').select('*').eq('text', currentRoom).single();
    if (error) return alert("同步失败");

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

// 自动识别 URL
const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom) { currentRoom = urlRoom; checkName(); }
