// --- 核心配置 ---
const SUPABASE_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 全局函数 ---
window.joinRoom = async function() {
    const room = document.getElementById('roomInput').value.trim();
    const user = document.getElementById('userInput').value.trim();
    if (!room || !user) return alert("房间和名字都要写！");

    currentRoom = room;
    myName = user;
    
    try {
        let { data, error } = await supabaseClient.from('scores').select('*').eq('text', currentRoom);
        if (error) throw error;

        let roomData = data[0];
        if (!roomData) {
            currentPlayers = [{name: myName, score: 0, avatar: '🀄️'}];
            await supabaseClient.from('scores').insert([{text: currentRoom, player_data: currentPlayers, history_data: []}]);
        } else {
            currentPlayers = roomData.player_data || [];
            if (!currentPlayers.find(p => p.name === myName)) {
                currentPlayers.push({name: myName, score: 0, avatar: '🀄️'});
                await supabaseClient.from('scores').update({player_data: currentPlayers}).eq('text', currentRoom);
            }
        }
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('roomIdDisplay').innerText = currentRoom;
        renderUI(currentPlayers, roomData ? roomData.history_data : []);
        subscribeUpdates();
    } catch (e) { alert("进场失败：" + e.message); }
};

function renderUI(players, history) {
    currentPlayers = players;
    const grid = document.getElementById('playerGrid');
    
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div class="card-top">
                <div class="avatar-circle" onclick="window.changeAvatar('${p.name}')">${p.avatar || '👤'}</div>
                <div class="info" onclick="window.togglePayBox('${p.name}')" style="flex:1">
                    <div class="p-name">${p.name}</div>
                    <div class="p-score ${p.score >= 0 ? 'plus' : 'minus'}">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}">
                <input type="number" class="quick-input" id="in-${p.name}" placeholder="金额" inputmode="numeric">
                <button class="quick-send-btn" onclick="window.quickPay('${p.name}')">转账</button>
            </div>
        </div>
    `).join('');
    
    // 流水渲染
    document.getElementById('logList').innerHTML = (history || []).slice().reverse().map(h => `
        <div class="log-item">${h.time} | ${h.from} ➔ ${h.to} [${h.pts}]</div>
    `).join('');
}

window.togglePayBox = function(name) {
    if (name === myName) return;
    const targetBox = document.getElementById(`box-${name}`);
    const isActive = targetBox.classList.contains('active');
    
    // 先关闭所有，再打开点击的那个
    document.querySelectorAll('.transfer-area').forEach(b => b.classList.remove('active'));
    if (!isActive) targetBox.classList.add('active');
};

window.quickPay = async function(targetName) {
    const input = document.getElementById(`in-${targetName}`);
    const pts = parseInt(input.value);
    if (!pts || pts <= 0) return;

    // 重新获取最新数据防止冲突
    let { data } = await supabaseClient.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data;
    let history = data.history_data || [];

    players = players.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === targetName) p.score += pts;
        return p;
    });

    history.push({ 
        from: myName, to: targetName, pts: pts, 
        time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) 
    });

    await supabaseClient.from('scores').update({player_data: players, history_data: history}).eq('text', currentRoom);
    input.value = '';
    document.getElementById(`box-${targetName}`).classList.remove('active');
};

// 换头像逻辑增加
window.changeAvatar = async function(name) {
    if (name !== myName) return;
    const avatars = ['🀄️','🧧','🎰','👸','👑','👾','📟','💎'];
    const currentIdx = avatars.indexOf(currentPlayers.find(p=>p.name===myName).avatar);
    const nextAvatar = avatars[(currentIdx + 1) % avatars.length];
    
    const nextPlayers = currentPlayers.map(p => {
        if (p.name === myName) p.avatar = nextAvatar;
        return p;
    });
    await supabaseClient.from('scores').update({player_data: nextPlayers}).eq('text', currentRoom);
};
