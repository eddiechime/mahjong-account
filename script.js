// --- 1. 配置 ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const db = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";
let currentPlayers = [];

// --- 2. 挂载全局函数 ---
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

// --- 3. 核心接入与【实时无感监听】 ---
async function enterBattle() {
    try {
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
        new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 130, height: 130 });

        renderUI(players, history);
        
        // 【关键】订阅实时频道，实现无感自动刷新
        db.channel(`room-${currentRoom}`).on('postgres_changes', { 
            event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` 
        }, payload => {
            console.log("云端同步成功！");
            renderUI(payload.new.player_data, payload.new.history_data);
        }).subscribe();

    } catch (e) { alert("进场失败: " + e.message); }
}

function renderUI(players, history) {
    currentPlayers = players;
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
            <div id="box-${p.name}" class="transfer-area" style="display:none; padding:15px; border-top:1px dashed #444;">
                <input type="number" id="in-${p.name}" placeholder="转账积分" inputmode="numeric" class="quick-input" style="width:100%; padding:10px; font-size:18px;">
                <button onclick="window.doPay('${p.name}')" class="btn-primary" style="margin-top:10px; width:100%; padding:10px; font-weight:900;">确认转账</button>
            </div>
        </div>
    `).join('');

    document.getElementById('logList').innerHTML = (history || []).slice
