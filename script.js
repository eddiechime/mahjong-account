const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";
let currentPlayers = [];

const allAvatars = ['👾','🕹️','📟','💿','🌈','🛹','🥤','🍕','🍟','🍔','🐱','🐶','🦊','🦁','🐯','🐼','🐻','🐨','🐰','🐸','👻','💀','👽','🤖','🎃','🦾','🧠','🧶','👓','🎩','🎭','🎨','🎬','🎤','🎧','🎸','🎹','🥁','🎷','🎺','🎳','🎮','🎯','🎲','🎰','🎱','🧩','🧸','🧧','💰','💎','🔮','🧿','🏮','🎴','🧪','🧬','🔭','🛸','🚀','🛰️','🪐','🌌','🌋','🍀','🍄','🌵','🌴','🐉','🐲','🦖','🐢','🐍','🐙','🦑','🦞','🦐','🐚','🍣','🍜','🥟','🍱','🍵','🍺','🍷','🍹','🍦','🍩','🍭','🍓','🥑','🥦','🌶️','🌽','🍡','🥞','🥨'];

// 1. 进房流程
window.startNewRoom = function() {
    currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
    checkName();
};

window.joinExistingRoom = function() {
    const val = document.getElementById('roomInput').value.trim();
    if (val.length !== 4) return alert("请输入4位房号");
    currentRoom = val;
    checkName();
};

function checkName() {
    if (!myName) {
        document.getElementById('nameModal').classList.remove('hidden');
    } else {
        enterBattle();
    }
}

window.saveNameAndStart = function() {
    const val = document.getElementById('userInput').value.trim();
    if (!val) return alert("请赐名");
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    enterBattle();
};

// 2. 核心接入
async function enterBattle() {
    try {
        let { data } = await sb.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        
        let players = data ? (data.player_data || []) : [];
        let history = data ? (data.history_data || []) : [];

        if (!players.find(p => p.name === myName)) {
            players.push({ name: myName, score: 0, avatar: '🀄️' });
            await sb.from('scores').upsert({ text: currentRoom, player_data: players, history_data: history });
        }

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), {
            text: window.location.origin + window.location.pathname + "?room=" + currentRoom,
            width: 140, height: 140
        });

        renderUI(players, history);
        
        sb.channel('any').on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => renderUI(payload.new.player_data, payload.new.history_data)
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
                <div style="width:60px; height:60px; background:#333; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:30px; margin-right:15px;" onclick="event.stopPropagation(); window.changeAvatar('${p.name}')">
                    ${p.avatar || '👤'}
                </div>
                <div style="flex:1">
                    <div style="font-size:14px; opacity:0.6">${p.name}</div>
                    <div class="p-score">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}">
                <input type="number" id="in-${p.name}" placeholder="金额" inputmode="numeric">
                <button class="btn-side" style="height:50px; width:80px" onclick="window.quickPay('${p.name}')">确定</button>
            </div>
        </div>
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

    let { data } = await sb.from('scores').select('*').eq('text', currentRoom).single();
    let players = data.player_data.map(p => {
        if (p.name === myName) p.score -= pts;
        if (p.name === target) p.score += pts;
        return p;
    });
    let history = data.history_data || [];
    history.push({ from: myName, to: target, pts: pts, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

    await sb.from('scores').update({ player_data: players, history_data: history }).eq('text', currentRoom);
    document.getElementById(`in-${target}`).value = "";
};

window.changeAvatar = async function(name) {
    if (name !== myName) return;
    const next = allAvatars[Math.floor(Math.random()*allAvatars.length)];
    const ps = currentPlayers.map(p => { if(p.name===myName) p.avatar=next; return p; });
    await sb.from('scores').update({ player_data: ps }).eq('text', currentRoom);
};
