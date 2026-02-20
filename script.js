// --- 1. 配置 ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const db = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";

// --- 2. 挂载全局函数，解决“点不动” ---
window.startNewRoom = function() {
    currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

window.joinExistingRoom = function() {
    const val = document.getElementById('roomInput').value;
    if (val.length !== 4) return alert("房号须为4位");
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
    if (!val) return;
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

// --- 3. 核心接入与实时监听 ---
async function enterBattle() {
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

    // 二维码生成
    document.getElementById('qrcode').innerHTML = "";
    new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 130, height: 130 });

    renderUI(players, history);
    
    // 开启实时同步监听
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
                <div class="p-avatar">${p.avatar || '👤'}</div>
                <div class="p-info">
                    <div class="p-name">${p.name}</div>
                    <div class="p-score">${p.score}</div>
                </div>
            </div>
            <div id="box-${p.name}" class="transfer-area" style="display:none; padding:15px; background:rgba(255,255,255,0.1); border-top:1px dashed #444;">
                <input type="number" id="in-${p.name}" placeholder="转账积分" inputmode="numeric" class="quick-input" style="width:100%; padding:10px; font-size:18px;">
                <button onclick="window.doPay('${p.name}')" class="btn-primary" style="margin-top:10px; width:100%; padding:10px; font-weight:900;">确认转账</button>
            </div>
        </div>
    `).join('');

    document.getElementById('logList').innerHTML = (history || []).slice().reverse().map(h => `
        <div class="log-item" style="font-size:12px; padding:5px; border-bottom:1px solid #333; opacity:0.7">${h.from} ➔ ${h.to} [${h.pts}]</div>
    `).join('');
}

window.toggleBox = (name) => {
    if (name === myName) return;
    const el = document.getElementById(`box-${name}`);
    const isVisible = el.style.display === 'block';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    el.style.display = isVisible ? 'none' : 'block';
};

// --- 4. 绝杀：先读后写，解决平行时空 ---
window.doPay = async (target) => {
    const val = parseInt(document.getElementById(`in-${target}`).value);
    if (!val || val <= 0) return;

    // A. 关键：转账瞬间强行获取云端最新分数
    let { data, error } = await db.from('scores').select('*').eq('text', currentRoom).single();
    if (error) return alert("同步失败，请检查网络");

    let latestPlayers = data.player_data;
    let latestHistory = data.history_data || [];

    // B. 在最新分数基础上进行计算
    latestPlayers = latestPlayers.map(p => {
        if (p.name === myName) p.score -= val;
        if (p.name === target) p.score += val;
        return p;
    });
    
    latestHistory.push({ from: myName, to: target, pts: val, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

    // C. 提交合并后的数据
    await db.from('scores').update({ player_data: latestPlayers, history_data: latestHistory }).eq('text', currentRoom);
    document.getElementById(`box-${target}`).style.display = 'none';
};

// 刷新重连逻辑
const urlRoom = new URLSearchParams(window.location.search).get('room');
if (urlRoom) { currentRoom = urlRoom; checkName(); }
