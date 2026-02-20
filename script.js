const SUPABASE_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentRoom = "";
let myName = "";
let currentData = { players: [], history: [] };

// 1. 加入房间逻辑
async function joinRoom() {
    const room = document.getElementById('roomInput').value.trim();
    const user = document.getElementById('userInput').value.trim();
    if (!room || !user) return alert("请填完整信息");

    currentRoom = room;
    myName = user;
    localStorage.setItem('saved_name', user); // 保存名字

    // 隐藏登录层
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('roomIdDisplay').innerText = currentRoom;

    // 初始化并开启监听
    await fetchRoomData();
    subscribeRoom();
}

// 2. 实时监听 (Realtime)
function subscribeRoom() {
    supabase.channel('room_updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scores', filter: `room_id=eq.${currentRoom}` }, 
        payload => {
            renderUI(payload.new.player_data, payload.new.history_data);
        }).subscribe();
}

// 3. 获取/创建房间数据
async function fetchRoomData() {
    let { data } = await supabase.from('scores').select('*').eq('room_id', currentRoom).maybeSingle();
    
    if (!data) {
        // 创建新房间，初始只有你自己
        const initPlayers = [{name: myName, score: 0, avatar: '👤'}];
        await supabase.from('scores').insert([{room_id: currentRoom, player_data: initPlayers, history_data: []}]);
        renderUI(initPlayers, []);
    } else {
        // 如果你在房间里不在，就把你加进去
        let players = data.player_data;
        if (!players.find(p => p.name === myName)) {
            players.push({name: myName, score: 0, avatar: '👤'});
            await supabase.from('scores').update({player_data: players}).eq('room_id', currentRoom);
        }
        renderUI(players, data.history_data);
    }
}

// 4. 渲染 UI (界限分明，易读性好)
function renderUI(players, history) {
    currentData = { players, history };
    const grid = document.getElementById('playerGrid');
    
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}" onclick="openTransfer('${p.name}')">
            <div class="avatar-circle">${p.avatar}</div>
            <div class="info">
                <span class="n">${p.name}</span>
                <span class="s ${p.score >= 0 ? 'p' : 'm'}">${p.score}</span>
            </div>
        </div>
    `).join('');

    const logList = document.getElementById('logList');
    logList.innerHTML = (history || []).slice().reverse().map(h => `
        <div class="log-item">
            <span class="time">${h.time}</span>
            <span class="msg"><b>${h.from}</b> 给 <b>${h.to}</b> 了 <b>${h.pts}</b></span>
        </div>
    `).join('');
}

let target = "";
function openTransfer(name) {
    if (name === myName) return;
    target = name;
    document.getElementById('modalTitle').innerText = `向 ${name} 付钱`;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// 5. 核心：防止平行时空的更新逻辑
async function confirmPay() {
    const pts = parseInt(document.getElementById('scoreInput').value);
    if (!pts) return;

    // 重新获取最新数据防止覆盖他人操作
    let { data } = await supabase.from('scores').select('*').eq('room_id', currentRoom).single();
    let players = data.player_data;
    let history = data.history_data || [];

    // 计算分数
    players = players.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === target) p.score += pts;
        return p;
    });

    // 记录流水
    const log = { from: myName, to: target, pts: pts, time: new Date().toLocaleTimeString('zh-CN',{hour12:false, minute:'2-digit', second:'2-digit'}) };
    history.push(log);

    const { error } = await supabase.from('scores')
        .update({ player_data: players, history_data: history })
        .eq('room_id', currentRoom);

    if (!error) {
        // 甄嬛版配音
        if (document.body.className === 'theme-palace') {
            const msg = new SpeechSynthesisUtterance(`赏赐${target}碎银${pts}两`);
            window.speechSynthesis.speak(msg);
        }
        closeModal();
    }
}

function changeTheme(t) { document.getElementById('mainBody').className = t; }

// 自动填入上次的名字
window.onload = () => {
    if(localStorage.getItem('saved_name')) document.getElementById('userInput').value = localStorage.getItem('saved_name');
}
