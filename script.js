// --- 1. 初始化 (变量名唯一化，防止冲突) ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = "";
let currentPlayers = [];

// --- 2. 100个90后&二次元头像库 ---
const allAvatars = [
    '👾','🕹️','📟','💿','🌈','🛹','🥤','🍕','🍟','🍔',
    '🐱','🐶','🦊','🦁','🐯','🐼','🐻','🐨','🐰','🐸',
    '👻','💀','👽','🤖','🎃','🦾','🧠','🧶','👓','🎩',
    '🎭','🎨','🎬','🎤','🎧','🎸','🎹','🥁','🎷','🎺',
    '🎳','🎮','🎯','🎲','🎰','🎱','🧩','🧸','🧧','💰',
    '💎','🔮','🧿','🏮','🎴','🎭','🧶','🧪','🧬','🔭',
    '🛸','🚀','🛰️','🪐','🌌','🌋','🍀','🍄','🌵','🌴',
    '🐉','🐲','🦖','🐢','🐍','🐙','🦑','🦞','🦐','🐚',
    '🍣','🍜','🥟','🍱','🍵','🍺','🍷','🍹','🍦','🍩',
    '🍭','🍓','🥑','🥦','🌶️','🌽','🍿','🍱','🍡','🥞'
];

// --- 3. 核心功能函数 (挂载到 window 确保 HTML 可访问) ---
window.joinRoom = async function() {
    const rInput = document.getElementById('roomInput');
    const uInput = document.getElementById('userInput');
    if (!rInput || !uInput) return;
    
    const room = rInput.value.trim();
    const user = uInput.value.trim();
    if (!room || !user) return alert("房间名和名字都要填哦！");

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
        
        // 开启监听
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
            <div class="transfer-area" id="box-${p.name}">
                <input type="number" class="quick-input" id="in-${p.name}" placeholder="金额" inputmode="numeric">
                <button class="quick-send-btn" onclick="window.quickPay('${p.name}')">确定</button>
            </div>
        </div>
    `).join('');
