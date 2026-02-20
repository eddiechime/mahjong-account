const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const sb = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = "";

// 创建新局：生成4位随机数
window.startNewRoom = function() {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    document.getElementById('roomInput').value = code;
    window.joinRoom();
};

window.joinRoom = async function() {
    const room = document.getElementById('roomInput').value.trim();
    const user = document.getElementById('userInput').value.trim();
    if (!room || !user) return alert("名字和房号都要有！");

    currentRoom = room;
    myName = user;

    try {
        let { data } = await sb.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        let players = data ? data.player_data : [{name: myName, score: 0, avatar: '🀄️'}];
        
        if (data && !players.find(p => p.name === myName)) {
            players.push({name: myName, score: 0, avatar: '🀄️'});
            await sb.from('scores').update({player_data: players}).eq('text', currentRoom);
        } else if (!data) {
            await sb.from('scores').insert([{text: currentRoom, player_data: players, history_data: []}]);
        }

        // 成功进入：隐藏遮罩，显示主界面
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房间号: " + currentRoom;
        
        // 生成二维码
        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), {
            text: window.location.href.split('?')[0] + "?room=" + currentRoom,
            width: 180, height: 180
        });

        renderUI(players, data ? data.history_data : []);
        subscribeUpdates();
    } catch (e) { alert("进入失败: " + e.message); }
};

function renderUI(players, history) {
    // 渲染逻辑...
    const count = players.length;
    document.getElementById('userCount').innerText = count;

    // 满4人自动移到边缘
    const infoBox = document.getElementById('roomInfoContainer');
    if (count >= 4) {
        infoBox.className = "room-info-edge";
    } else {
        infoBox.className = "room-info-center";
    }
    
    // (接之前的卡片渲染代码...)
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div class="card-top">
                <div class="avatar-circle" onclick="window.changeAvatar('${p.name}')">${p.avatar || '👤'}</div>
                <div class="info" onclick="window.togglePayBox('${p.name}')">
                    <div class="p-name">${p.name}</div>
                    <div class="p-score">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}" style="display:none">
                <input type="number" id="in-${p.name}" placeholder="金额" inputmode="numeric">
                <button onclick="window.quickPay('${p.name}')">确定</button>
            </div>
        </div>
    `).join('');
}

function subscribeUpdates() {
    sb.channel('updates').on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
        payload => renderUI(payload.new.player_data, payload.new.history_data)
    ).subscribe();
}
