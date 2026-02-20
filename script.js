// --- 1. 初始化配置 ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const sbClient = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";
let currentPlayers = [];

// --- 2. 自动进房与参数识别 ---
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
    if (!val) return alert("请赐名");
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

// --- 3. 核心接入：开启实时频道监听 ---
async function enterBattle() {
    try {
        let { data } = await sbClient.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        let players = data ? (data.player_data || []) : [];
        let history = data ? (data.history_data || []) : [];

        if (!players.find(p => p.name === myName)) {
            players.push({ name: myName, score: 0, avatar: '🀄️' });
            await sbClient.from('scores').upsert({ text: currentRoom, player_data: players, history_data: history });
        }

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

        // 生成含参数二维码，方便扫码即入
        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 140, height: 140 });

        renderUI(players, history);
        
        // 【关键】实时监听：只要数据库变了，立刻刷新所有人的屏幕
        sbClient.channel(`room-${currentRoom}`).on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => { if(payload.new) renderUI(payload.new.player_data, payload.new.history_data); }
        ).subscribe();

    } catch (e) { alert("进场失败: " + e.message); }
}

function renderUI(players, history) {
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
            <div class="transfer-area" id="box-${p.name}" style="display:none; flex-direction:column; gap:10px; margin-top:15px; border-top:1px dashed #444; padding-top:15px;">
                <input type="number" id="in-${p.name}" placeholder="金额" inputmode="numeric">
                <button class="btn-primary" style="margin:0; padding:12px" onclick="window.quickPay('${p.name}')">确认转账</button>
            </div>
        </div>
    `).join('');

    document.getElementById('logList').innerHTML = (history || []).slice().reverse().map(h => `
        <div style="padding:8px; font-size:12px; border-bottom:1px solid #333; color:#ccc">${h.time} | ${h.from} ➔ ${h.to} [${h.pts}]</div>
    `).join('');
}

window.toggleBox = function(name) {
    if (name === myName) return;
    const box = document.getElementById(`box-${name}`);
    const isShow = box.style.display === 'flex';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    box.style.display = isShow ? 'none' : 'flex';
};

// --- 4. 【核心修复】转账前强行拉取云
