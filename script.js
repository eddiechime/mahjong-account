const URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const db = supabase.createClient(URL, KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";

// --- 挂载全局函数，解决“点不动” ---
window.startNewRoom = () => {
    currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

window.joinExistingRoom = () => {
    currentRoom = document.getElementById('roomInput').value;
    if(currentRoom.length !== 4) return alert("房号不对");
    window.history.pushState({}, '', `?room=${currentRoom}`);
    checkName();
};

window.saveNameAndStart = () => {
    const val = document.getElementById('userInput').value.trim();
    if(!val) return;
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

function checkName() {
    if(!myName) document.getElementById('nameModal').classList.remove('hidden');
    else enterBattle();
}

async function enterBattle() {
    // 1. 获取初始数据
    let { data } = await db.from('scores').select('*').eq('text', currentRoom).maybeSingle();
    let players = data ? (data.player_data || []) : [];
    
    if (!players.find(p => p.name === myName)) {
        players.push({ name: myName, score: 0, avatar: '🀄️' });
        await db.from('scores').upsert({ text: currentRoom, player_data: players, history_data: data?.history_data || [] });
    }

    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('appMain').classList.remove('hidden');
    document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;
    
    // 2. 实时监听 (解决平行时空的关键)
    db.channel(`room-${currentRoom}`).on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` 
    }, payload => {
        renderUI(payload.new.player_data, payload.new.history_data);
    }).subscribe();

    renderUI(players, data?.history_data || []);
}

function renderUI(players, history) {
    document.getElementById('userCount').innerText = players.length;
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div class="p-main" onclick="window.toggleBox('${p.name}')">
                <span class="p-avatar">${p.avatar || '👤'}</span>
                <span class="p-name">${p.name}</span>
                <span class="p-score">${p.score}</span>
            </div>
            <div id="box-${p.name}" class="transfer-area" style="display:none; padding:10px;">
                <input type="number" id="in-${p.name}" placeholder="金额" class="quick-input">
                <button onclick="window.doPay('${p.name}')" class="btn-pay">确认转账</button>
            </div>
        </div>
    `).join('');
}

window.toggleBox = (name) => {
    if(name === myName) return;
    const el = document.getElementById(`box-${name}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.doPay = async (target) => {
    const val = parseInt(document.getElementById(`in-${target}`).value);
    if(!val) return;

    // 绝杀：转账前强行重新拉取云端分数，合并平行时空
    let { data } = await db.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data.map(p => {
        if(p.name === myName) p.score -= val;
        if(p.name === target) p.score += val;
        return p;
    });
    let history = data.history_data || [];
    history.push({ from: myName, to: target, pts: val, time: new Date().toLocaleTimeString() });

    await db.from('scores').update({ player_data: players, history_data: history }).eq('text', currentRoom);
    document.getElementById(`box-${target}`).style.display = 'none';
};

// 自动重连
if(new URLSearchParams(window.location.search).get('room')) {
    currentRoom = new URLSearchParams(window.location.search).get('room');
    checkName();
}
