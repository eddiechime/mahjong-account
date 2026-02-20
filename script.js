// --- 1. 配置：变量名唯一化，防止声明冲突 ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const sbClient = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";
let currentPlayers = [];

// 100个90后精选头像
const allAvatars = ['👾','🕹️','📟','💿','🌈','🛹','🥤','🍕','🍟','🍔','🐱','🐶','🦊','🦁','🐯','🐼','🐻','🐨','🐰','🐸','👻','💀','👽','🤖','🎃','🦾','🧠','👓','🎩','🎭','🎨','🎬','🎤','🎧','🎸','🎹','🥁','🎷','🎺','🎳','🎮','🎯','🎲','🎰','🎱','🧩','🧸','🧧','💰','💎','🔮','🧿','🏮','🎴','🧪','🧬','🔭','🛸','🚀','🛰️','🪐','🌌','🌋','🍀','🍄','🌵','🌴','🐉','🐲','🦖','🐢','🐍','🐙','🦑','🦞','🦐','🐚','🍣','🍜','🥟','🍱','🍵','🍺','🍷','🍹','🍦','🍩','🍭','🍓','🥑','🥦','🌶️','🌽','🍿','🍡','🥞','🥨'];

// --- 2. 进场与刷新逻辑 (解决刷新回首页痛点) ---
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

// --- 3. 联机交互 (解决平行时空痛点) ---
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

        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 140, height: 140 });

        renderUI(players, history);
        
        sbClient.channel('updates').on('postgres_changes', 
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
            <div style="display:flex; align-items:center; position:relative; z-index:2" onclick="window.toggleBox('${p.name}')">
                <div class="avatar-circle" style="width:60px; height:
