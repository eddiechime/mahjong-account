// --- 1. 配置：变量名唯一化 ---
const MAHJONG_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const MAHJONG_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const mahjongClient = window.supabase.createClient(MAHJONG_URL, MAHJONG_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";
let currentPlayers = [];

const allAvatars = ['👾','🕹️','📟','💿','🌈','🛹','🥤','🍕','🍟','🍔','🐱','🐶','🦊','🦁','🐯','🐼','🐻','🐨','🐰','🐸','👻','💀','👽','🤖','🎃','🦾','🧠','👓','🎩','🎭','🎨','🎬','🎤','🎧','🎸','🎹','🥁','🎷','🎺','🧧','💰','💎','🔮','🧿','🏮','🎴','🧪','🧬','🔭','🛸','🚀','🛰️','🪐','🌌','🌋','🍀','🍄','🌵','🌴','🐉','🐲','🦖','🐢','🐍','🐙','🦑','🦞','🦐','🐚','🍣','🍜','🥟','🍱','🍵','🍺','🍷','🍹','🍦','🍩','🍭','🍓','🥑','🥦','🌶️','🌽','🍿','🍡','🥞','🥨'];

// --- 2. 挂载全局函数 ---
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

// --- 3. 核心接入 (修复平行时空) ---
async function enterBattle() {
    try {
        let { data } = await mahjongClient.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        let players = data ? (data.player_data || []) : [];
        let history = data ? (data.history_data || []) : [];

        if (!players.find(p => p.name === myName)) {
            players.push({ name: myName, score: 0, avatar: '🀄️' });
            await mahjongClient.from('scores').upsert({ text: currentRoom, player_data: players, history_data: history });
        }

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 140, height: 140 });

        renderUI(players, history);
        
        mahjongClient.channel('any').on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => { if(payload.new) renderUI(payload.new.player_data, payload.new.history_data); }
        ).subscribe();
    } catch (e) { alert("连接失败: " + e.message); }
}

function renderUI(players, history) {
    currentPlayers = players;
    document.getElementById('userCount').innerText = players.length;
    document.getElementById('roomInfoContainer').className = (players.length >= 4) ? "room-info-edge" : "room-info-center";

    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div style="display:flex; align-items:center; position:relative; z-index:2" onclick="window.toggleBox('${p.name}')">
                <div class="avatar-circle" style="width:60px; height:60px; background:#333; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:30px; margin-right:15px;" onclick="event.stopPropagation(); window.changeAvatar('${p.name}')">
                    ${p.avatar || '👤'}
                </div>
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

window.quickPay = async function(target) {
    const pts = parseInt(document.getElementById(`in-${target}`).value);
    if (!pts || pts <= 0) return;

    // 先读后写：彻底解决平行时空
    let { data } = await mahjongClient.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === target) p.score += pts;
        return p;
    });
    let history = data.history_data || [];
    history.push({ from: myName, to: target, pts: pts, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

    await mahjongClient.from('scores').update({ player_data: players, history_data: history }).eq('text', currentRoom);
};

window.changeAvatar = async function(name) {
    if (name !== myName) return;
    const next = allAvatars[Math.floor(Math.random()*allAvatars.length)];
    const ps = currentPlayers.map(p => { if(p.name===myName) p.avatar=next; return p; });
    await mahjongClient.from('scores').update({ player_data: ps }).eq('text', currentRoom);
};
