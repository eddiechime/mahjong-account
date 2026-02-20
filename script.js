const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const sbClient = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";
let currentPlayers = [];

// --- 1. 自动重连逻辑 ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        currentRoom = roomFromUrl;
        window.checkName();
    }
};

window.startNewRoom = function() {
    currentRoom = Math.floor(1000 + Math.random() * 9000).toString();
    window.history.pushState({}, '', `?room=${currentRoom}`);
    window.checkName();
};

window.joinExistingRoom = function() {
    const val = document.getElementById('roomInput').value.trim();
    if (val.length !== 4) return alert("请输入4位房号");
    currentRoom = val;
    window.history.pushState({}, '', `?room=${currentRoom}`);
    window.checkName();
};

window.checkName = function() {
    if (!myName) document.getElementById('nameModal').classList.remove('hidden');
    else window.enterBattle();
};

window.saveNameAndStart = function() {
    const val = document.getElementById('userInput').value.trim();
    if (!val) return alert("请输入名字");
    myName = val;
    localStorage.setItem('mahjong_name', val);
    document.getElementById('nameModal').classList.add('hidden');
    window.enterBattle();
};

// --- 2. 核心：联机同步与实时监听 ---
window.enterBattle = async function() {
    try {
        // 强制读取最新数据，避免缓存
        let { data, error } = await sbClient.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        if (error) throw error;

        let players = data ? (data.player_data || []) : [];
        let history = data ? (data.history_data || []) : [];

        // 如果你是新加入的，写回数据库
        if (!players.find(p => p.name === myName)) {
            players.push({ name: myName, score: 0, avatar: '🀄️' });
            const { error: upsertError } = await sbClient.from('scores').upsert({ text: currentRoom, player_data: players, history_data: history });
            if (upsertError) throw upsertError;
        }

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

        // 生成带参数的二维码，确保别人扫了能直接进
        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 140, height: 140 });

        renderUI(players, history);
        
        // 重点：开启全频道实时同步
        sbClient.channel(`room-${currentRoom}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => {
                console.log("检测到云端更新:", payload.new);
                renderUI(payload.new.player_data, payload.new.history_data);
            })
            .subscribe(status => console.log("实时监听状态:", status));

    } catch (e) { 
        console.error("进入战场失败:", e);
        alert("连接失败，请确认网络或检查 Supabase 权限！");
    }
};

function renderUI(players, history) {
    currentPlayers = players;
    document.getElementById('userCount').innerText = players.length;
    // 满4人自动位移
    document.getElementById('roomInfoContainer').className = (players.length >= 4) ? "room-info-edge" : "room-info-center";

    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div
