const supabaseUrl = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const supabaseKey = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentRoom = "";
let myName = "";
let currentPlayers = [];
let currentHistory = [];

// 90后喜欢的头像库 (Y2K像素风 + 搞怪)
const y2kAvatars = ['👾', '🐱‍👤', '🌈', '💿', '🎸', '🕹️', '📟', '🛹', '🍹', '🎈'];
// 甄嬛传缩写/符号头像
const palaceAvatars = ['👸', '🍵', '📿', '💄', '👑', '🦢', '🧧'];

// 进入战场
window.joinRoom = async function() {
    const room = document.getElementById('roomInput').value.trim();
    const user = document.getElementById('userInput').value.trim();
    if (!room || !user) return alert("房间名和名字都要填哦！");

    currentRoom = room;
    myName = user;

    try {
        let { data, error } = await supabaseClient.from('scores').select('*').eq('text', currentRoom);
        if (error) throw error;

        let roomData = data[0];
        if (!roomData) {
            currentPlayers = [{name: myName, score: 0, avatar: '👾'}];
            await supabaseClient.from('scores').insert([{text: currentRoom, player_data: currentPlayers, history_data: []}]);
        } else {
            currentPlayers = roomData.player_data || [];
            currentHistory = roomData.history_data || [];
            if (!currentPlayers.find(p => p.name === myName)) {
                currentPlayers.push({name: myName, score: 0, avatar: '👾'});
                await supabaseClient.from('scores').update({player_data: currentPlayers}).eq('text', currentRoom);
            }
        }

        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('roomIdDisplay').innerText = currentRoom;
        renderUI(currentPlayers, currentHistory);
        subscribeUpdates();

    } catch (err) {
        alert("连接失败: " + err.message);
    }
}

// 实时同步渲染
function renderUI(players, history) {
    currentPlayers = players;
    currentHistory = history || [];
    
    // 渲染玩家卡片 (界限分明)
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div class="avatar-circle" onclick="window.changeAvatar('${p.name}')">${p.avatar || '👤'}</div>
            <div class="info" onclick="window.openTransfer('${p.name}')">
                <div class="p-name">${p.name}</div>
                <div class="p-score ${p.score >= 0 ? 'plus' : 'minus'}">${p.score}</div>
            </div>
        </div>
    `).join('');

    // 渲染流水
    const logList = document.getElementById('logList');
    logList.innerHTML = currentHistory.slice().reverse().map(h => `
        <div class="log-item">
            <span class="t">${h.time}</span> <strong>${h.from}</strong> ➔ <strong>${h.to}</strong> <span class="v">${h.pts}</span>
        </div>
    `).join('');
}

// 记分系统：点击头像以外的区域触发转账
let targetPlayer = "";
window.openTransfer = function(name) {
    if (name === myName) return;
    targetPlayer = name;
    document.getElementById('modalTitle').innerText = `向 ${name} 付钱`;
    document.getElementById('modal').classList.remove('hidden');
}

window.closeModal = function() { document.getElementById('modal').classList.add('hidden'); }

// 确认转账逻辑
window.confirmPay = async function() {
    const pts = parseInt(document.getElementById('scoreInput').value);
    if (!pts || pts <= 0) return;

    // 防止“平行时空”冲突：更新前先取最新数据
    let { data } = await supabaseClient.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data;
    let history = data.history_data || [];

    players = players.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === targetPlayer) p.score += pts;
        return p;
    });

    history.push({
        from: myName, to: targetPlayer, pts: pts,
        time: new Date().toLocaleTimeString('zh-CN', {hour12:false, hour:'2-digit', minute:'2-digit'})
    });

    const { error } = await supabaseClient.from('scores').update({player_data: players, history_data: history}).eq('text', currentRoom);
    if (!error) {
        // 甄嬛传语音
        if (document.body.className === 'theme-palace') {
            const speak = new SpeechSynthesisUtterance(`赏赐${targetPlayer}碎银${pts}两`);
            window.speechSynthesis.speak(speak);
        }
        document.getElementById('scoreInput').value = '';
        closeModal();
    }
}

// 随机换头像逻辑
window.changeAvatar = async function(name) {
    if (name !== myName) return; // 只能改自己的
    const list = document.body.className === 'theme-palace' ? palaceAvatars : y2kAvatars;
    const nextAvatar = list[Math.floor(Math.random() * list.length)];
    
    currentPlayers = currentPlayers.map(p => {
        if (p.name === myName) p.avatar = nextAvatar;
        return p;
    });

    await supabaseClient.from('scores').update({player_data: currentPlayers}).eq('text', currentRoom);
}

function subscribeUpdates() {
    supabaseClient.channel('realtime_room').on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
        payload => renderUI(payload.new.player_data, payload.new.history_data)
    ).subscribe();
}

window.changeTheme = function(t) { document.getElementById('mainBody').className = t; }
// --- 核心变量保持不变 ---
const SUPABASE_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 渲染 UI：加入内嵌输入框
function renderUI(players, history) {
    currentPlayers = players;
    currentHistory = history || [];
    
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}" id="card-${p.name}">
            <div style="display:flex; align-items:center; width:100%">
                <div class="avatar-circle" onclick="handleAvatarClick('${p.name}')">${p.avatar || '👤'}</div>
                <div class="info">
                    <div class="p-name">${p.name}</div>
                    <div class="p-score ${p.score >= 0 ? 'plus' : 'minus'}">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}">
                <input type="number" class="quick-input" id="in-${p.name}" placeholder="输入金额..." 
                       onkeypress="if(event.keyCode==13) window.quickPay('${p.name}')">
                <button class="quick-send-btn" onclick="window.quickPay('${p.name}')">转账</button>
            </div>
        </div>
    `).join('');

    // 更新流水记录
    const logList = document.getElementById('logList');
    logList.innerHTML = currentHistory.slice().reverse().map(h => `
        <div class="log-item"><b>${h.from}</b> ▶ <b>${h.to}</b> [${h.pts}两]</div>
    `).join('');
}

// 处理点击逻辑：分清换头像和转账
window.handleAvatarClick = function(name) {
    if (name === myName) {
        // 点击自己：换头像
        window.changeAvatar(name);
    } else {
        // 点击别人：展开/折叠输入框
        const allBoxes = document.querySelectorAll('.transfer-area');
        allBoxes.forEach(b => b.classList.remove('active'));
        document.getElementById(`box-${name}`).classList.add('active');
        document.getElementById(`in-${name}`).focus();
    }
}

// 无感快传逻辑
window.quickPay = async function(targetName) {
    const input = document.getElementById(`in-${targetName}`);
    const pts = parseInt(input.value);
    if (!pts || pts <= 0) return;

    // 1. 获取最新数据防止冲突
    let { data } = await supabaseClient.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data;
    let history = data.history_data || [];

    // 2. 更新数值
    players = players.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === targetName) p.score += pts;
        return p;
    });

    // 3. 记录流水
    history.push({ from: myName, to: targetName, pts: pts, 
        time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) 
    });

    // 4. 同步云端
    const { error } = await supabaseClient.from('scores').update({player_data: players, history_data: history}).eq('text', currentRoom);
    
    if (!error) {
        // 甄嬛传音效
        if (document.body.className === 'theme-palace') {
            const speak = new SpeechSynthesisUtterance(`赏赐${targetName}碎银${pts}两`);
            window.speechSynthesis.speak(speak);
        }
        input.value = '';
        document.getElementById(`box-${targetName}`).classList.remove('active');
    }
}

// 登录按钮文字适配
window.changeTheme = function(t) { 
    document.getElementById('mainBody').className = t; 
    const btn = document.querySelector('.login-box button');
    btn.innerText = (t === 'theme-palace') ? "开启宫斗" : "接入矩阵";
}
