// 核心：确保只声明一次！
const supabaseUrl = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const supabaseKey = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey); // 变量名改掉，防止冲突

let currentRoom = "";
let myName = "";

// 关键：将函数挂载到全局，确保 HTML 能点到
window.joinRoom = async function() {
    console.log("正在尝试加入战场...");
    const roomInput = document.getElementById('roomInput');
    const userInput = document.getElementById('userInput');
    
    if (!roomInput || !userInput) return;
    
    const room = roomInput.value.trim();
    const user = userInput.value.trim();
    
    if (!room || !user) {
        alert("请输入房间名和名字！");
        return;
    }

    currentRoom = room;
    myName = user;

    try {
        // 1. 尝试获取房间数据
        let { data, error } = await supabaseClient.from('scores').select('*').eq('text', currentRoom);
        if (error) throw error;

        let roomData = data[0];
        let players = [];
        let history = [];

        if (!roomData) {
            // 2. 没房就建新房
            players = [{name: myName, score: 0, avatar: '🀄️'}];
            await supabaseClient.from('scores').insert([{text: currentRoom, player_data: players, history_data: []}]);
        } else {
            // 3. 有房就加入
            players = roomData.player_data || [];
            history = roomData.history_data || [];
            if (!players.find(p => p.name === myName)) {
                players.push({name: myName, score: 0, avatar: '👤'});
                await supabaseClient.from('scores').update({player_data: players}).eq('text', currentRoom);
            }
        }

        // 4. 进入成功，切换 UI
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('roomIdDisplay').innerText = currentRoom;
        renderUI(players, history);
        
        // 开启监听
        subscribeUpdates();

    } catch (err) {
        console.error("连接失败:", err.message);
        alert("连接失败: " + err.message);
    }
}

function subscribeUpdates() {
    supabaseClient.channel('any').on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
        payload => renderUI(payload.new.player_data, payload.new.history_data)
    ).subscribe();
}

function renderUI(players, history) {
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}" onclick="openTransfer('${p.name}')">
            <div class="avatar-circle">${p.avatar || '👤'}</div>
            <div class="info">
                <div class="p-name">${p.name}</div>
                <div class="p-score">${p.score}</div>
            </div>
        </div>
    `).join('');
    // ... 其他渲染代码保持原样
}
