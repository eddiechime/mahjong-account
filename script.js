// --- 1. 初始化 ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = "";
let currentPlayers = [];

// --- 2. 100个精选头像库 ---
const allAvatars = [
    '👾','🕹️','📟','💿','🌈','🛹','🥤','🍕','🍟','🍔','🐱','🐶','🦊','🦁','🐯','🐼','🐻','🐨','🐰','🐸',
    '👻','💀','👽','🤖','🎃','🦾','🧠','🧶','👓','🎩','🎭','🎨','🎬','🎤','🎧','🎸','🎹','🥁','🎷','🎺',
    '🎳','🎮','🎯','🎲','🎰','🎱','🧩','🧸','🧧','💰','💎','🔮','🧿','🏮','🎴','🧪','🧬','🔭','🛸','🚀',
    '🛰️','🪐','🌌','🌋','🍀','🍄','🌵','🌴','🐉','🐲','Rex','🦖','🐢','🐍','🐙','🦑','🦞','🦐','🐚','🍣',
    '🍜','🥟','🍱','🍵','🍺','🍷','🍹','🍦','🍩','🍭','🍓','🥑','🥦','🌶️','🌽','🍿','🍡','🥞','🥨','🥨'
];

// --- 3. 核心功能 ---
window.joinRoom = async function() {
    const room = document.getElementById('roomInput').value.trim();
    const user = document.getElementById('userInput').value.trim();
    if (!room || !user) return alert("房间名和名字都要填！");

    currentRoom = room;
    myName = user;

    try {
        let { data, error } = await sb.from('scores').select('*').eq('text', currentRoom);
        if (error) throw error;

        let roomData = data[0];
        if (!roomData) {
            currentPlayers = [{name: myName, score: 0, avatar: '🀄️'}];
            await sb.from('scores').insert([{text: currentRoom, player_data: currentPlayers, history_data: []}]);
        } else {
            currentPlayers = roomData.player_data || [];
            if (!currentPlayers.find(p => p.name === myName)) {
                currentPlayers.push({name: myName, score: 0, avatar: '🀄️'});
                await sb.from('scores').update({player_data: currentPlayers}).eq('text', currentRoom);
            }
        }
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('roomIdDisplay').innerText = currentRoom;
        renderUI(currentPlayers, roomData ? roomData.history_data : []);
        
        sb.channel('updates').on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => renderUI(payload.new.player_data, payload.new.history_data)
        ).subscribe();
    } catch (e) { alert("进场失败: " + e.message); }
};

function renderUI(players, history) {
    currentPlayers = players;
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div class="card-top">
                <div class="avatar-circle" onclick="window.changeAvatar('${p.name}')">${p.avatar || '👤'}</div>
                <div class="info" onclick="window.togglePayBox('${p.name}')">
                    <div class="p-name">${p.name}</div>
                    <div class="p-score ${p.score >= 0 ? 'plus' : 'minus'}">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}" style="display:none; padding:15px; background:#333; gap:10px;">
                <input type="number" class="quick-input" id="in-${p.name}" placeholder="金额" inputmode="numeric" style="flex:1; height:40px;">
                <button onclick="window.quickPay('${p.name}')" style="height:40px; padding:0 15px; background:#ffeb3b; color:#000; border:none; font-weight:900;">确定</button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('logList').innerHTML = (history || []).slice().reverse().map(h => `
        <div class="log-item" style="padding:8px; border-bottom:1px solid #444; color:#aaa; font-size:14px;">${h.time} | ${h.from} ➔ ${h.to} [${h.pts}]</div>
    `).join('');
}

window.togglePayBox = function(name) {
    if (name === myName) return;
    const box = document.getElementById(`box-${name}`);
    const isAct = box.style.display === 'flex';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    box.style.display = isAct ? 'none' : 'flex';
};

window.quickPay = async function(targetName) {
    const input = document.getElementById(`in-${targetName}`);
    const pts = parseInt(input.value);
    if (!pts || pts <= 0) return;

    let { data } = await sb.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === targetName) p.score += pts;
        return p;
    });
    let history = data.history_data || [];
    history.push({ from: myName, to: targetName, pts: pts, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

    await sb.from('scores').update({player_data: players, history_data: history}).eq('text', currentRoom);
    input.value = '';
    document.getElementById(`box-${targetName}`).style.display = 'none';
};

window.changeAvatar = async function(name) {
    if (name !== myName) return;
    const nextAvatar = allAvatars[Math.floor(Math.random() * allAvatars.length)];
    const nextPlayers = currentPlayers.map(p => {
        if (p.name === myName) p.avatar = nextAvatar;
        return p;
    });
    await sb.from('scores').update({player_data: nextPlayers}).eq('text', currentRoom);
};
