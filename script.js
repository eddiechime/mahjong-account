// --- 1. 初始化 ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const dbClient = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";

// --- 2. 挂载全局函数 ---
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    if (room) { currentRoom = room; checkName(); }
};

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

function checkName() {
    if (!myName) document.getElementById('nameModal').classList.remove('hidden');
    else enterBattle();
}

window.saveNameAndStart = () => {
    const val = document.getElementById('userInput').value.trim();
    if (!val) return;
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

// --- 3. 联机与无感实时监听 ---
async function enterBattle() {
    try {
        let { data } = await dbClient.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        let players = data ? (data.player_data || []) : [];

        if (!players.find(p => p.name === myName)) {
            players.push({ name: myName, score: 0, avatar: '🀄️' });
            await dbClient.from('scores').upsert({ text: currentRoom, player_data: players, history_data: data?.history_data || [] });
        }

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 140, height: 140 });

        renderUI(players, data?.history_data || []);
        
        // 实时频道订阅
        dbClient.channel(`room-${currentRoom}`).on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => { if(payload.new) renderUI(payload.new.player_data, payload.new.history_data); }
        ).subscribe();
    } catch (e) { alert("进场失败，请检查网络权限！"); }
}

function renderUI(players, history) {
    document.getElementById('userCount').innerText = players.length;
    document.getElementById('roomInfoContainer').className = (players.length >= 4) ? "room-info-edge" : "room-info-center";
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div class="card-main" onclick="window.toggleBox('${p.name}')" style="cursor:pointer; display:flex; align-items:center;">
                <div class="avatar-circle">${p.avatar || '👤'}</div>
                <div style="flex:1">
                    <div class="p-name">${p.name}</div>
                    <div class="p-score" style="font-size:35px; font-weight:900;">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}" style="display:none; padding:15px; background:rgba(255,255,255,0.1); border-top:1px dashed #444; position:relative; z-index:9999;">
                <input type="number" id="in-${p.name}" placeholder="积分" inputmode="numeric" style="width:100%; padding:12px; font-size:20px; border-radius:8px; border:none;">
                <button onclick="window.doPay('${p.name}')" style="width:100%; margin-top:10px; padding:12px; background:#ffeb3b; color:#000; font-weight:900; border:none; border-radius:8px;">确认转账</button>
            </div>
        </div>
    `).join('');
}

window.toggleBox = (name) => {
    if (name === myName) return;
    const box = document.getElementById(`box-${name}`);
    const isShow = box.style.display === 'block';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    box.style.display = isShow ? 'none' : 'block';
};

// --- 4. 终结平行时空逻辑 ---
window.doPay = async (target) => {
    const val = parseInt(document.getElementById(`in-${target}`).value);
    if (!val || val <= 0) return;

    try {
        // 先读后写：解决平行时空的核心
        let { data, error: selectErr } = await dbClient.from('scores').select('*').eq('text', currentRoom).single();
        if (selectErr) throw selectErr;

        let players = data.player_data.map(p => {
            if (p.name === myName) p.score -= val;
            if (p.name === target) p.score += val;
            return p;
        });
        let history = data.history_data || [];
        history.push({ from: myName, to: target, pts: val, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

        const { error: updateErr } = await dbClient.from('scores').update({ player_data: players, history_data: history }).eq('text', currentRoom);
        if (updateErr) throw updateErr;

        document.getElementById(`box-${target}`).style.display = 'none';
    } catch (e) {
        console.error(e);
        alert("同步失败！请检查 Supabase 里的 GRANT ALL 权限。");
    }
};
