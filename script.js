const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const dbClient = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";

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
    if (!val) return alert("请赐名");
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

async function enterBattle() {
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
    new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 130, height: 130 });

    renderUI(players, data?.history_data || []);

    // 开启实时同步监听
    dbClient.channel(`room-${currentRoom}`).on('postgres_changes', { 
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
            <div class="card-main" onclick="window.toggleBox('${p.name}')" style="cursor:pointer; position:relative; z-index:10;">
                <span class="p-avatar">${p.avatar || '👤'}</span>
                <span class="p-name">${p.name}</span>
                <span class="p-score">${p.score}</span>
            </div>
            <div id="box-${p.name}" class="transfer-area" style="display:none; padding:15px; background:rgba(255,255,255,0.1); position:relative; z-index:100;">
                <input type="number" id="in-${p.name}" placeholder="转账积分" inputmode="numeric" style="width:100%; padding:10px; font-size:20px; border-radius:8px;">
                <button onclick="window.quickPay('${p.name}')" style="width:100%; margin-top:10px; padding:12px; background:#ffeb3b; color:#000; font-weight:900; border-radius:8px; border:none;">确认转账</button>
            </div>
        </div>
    `).join('');

    document.getElementById('logList').innerHTML = (history || []).slice().reverse().map(h => `
        <div style="font-size:12px; padding:5px; border-bottom:1px solid #444; color:#ccc">${h.time} | ${h.from} ➔ ${h.to} [${h.pts}]</div>
    `).join('');
}

window.toggleBox = (name) => {
    if (name === myName) return;
    const box = document.getElementById(`box-${name}`);
    const isShow = box.style.display === 'block';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    box.style.display = isShow ? 'none' : 'block';
};

// 终极修复平行时空：先读后写
window.quickPay = async (target) => {
    const val = parseInt(document.getElementById(`in-${target}`).value);
    if (!val || val <= 0) return;

    let { data } = await dbClient.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data.map(p => {
        if (p.name === myName) p.score -= val;
        if (p.name === target) p.score += val;
        return p;
    });
    let history = data.history_data || [];
    history.push({ from: myName, to: target, pts: val, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

    await dbClient.from('scores').update({ player_data: players, history_data: history }).eq('text', currentRoom);
    document.getElementById(`box-${target}`).style.display = 'none';
};
