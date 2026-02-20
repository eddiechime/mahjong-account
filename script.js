// --- 1. 唯一初始化 ---
const SB_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SB_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const mahjongDb = window.supabase.createClient(SB_URL, SB_KEY);

let currentRoom = "";
let myName = localStorage.getItem('mahjong_name') || "";

// --- 2. 挂载全局函数 ---
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
    const val = document.getElementById('roomInput').value;
    if (val.length !== 4) return alert("房号需4位");
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

// --- 3. 联机与无感更新 ---
window.enterBattle = async function() {
    try {
        let { data, error } = await mahjongDb.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        if (error) throw error;

        let players = data ? (data.player_data || []) : [];
        let history = data ? (data.history_data || []) : [];

        if (!players.find(p => p.name === myName)) {
            players.push({ name: myName, score: 0, avatar: '🀄️' });
            await mahjongDb.from('scores').upsert({ text: currentRoom, player_data: players, history_data: history });
        }

        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appMain').classList.remove('hidden');
        document.getElementById('roomCodeDisplay').innerText = "房号: " + currentRoom;

        document.getElementById('qrcode').innerHTML = "";
        new QRCode(document.getElementById("qrcode"), { text: window.location.href, width: 140, height: 140 });

        renderUI(players, history);
        
        // 实时订阅：解决 Lynn 那边不刷新的问题
        mahjongDb.channel(`room-${currentRoom}`).on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'scores', filter: `text=eq.${currentRoom}` }, 
            payload => { if(payload.new) renderUI(payload.new.player_data, payload.new.history_data); }
        ).subscribe();

    } catch (e) { alert("进场失败，请确认已在后台运行 DISABLE RLS！"); }
};

function renderUI(players, history) {
    document.getElementById('userCount').innerText = players.length;
    document.getElementById('roomInfoContainer').className = (players.length >= 4) ? "room-info-edge" : "room-info-center";

    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card ${p.name === myName ? 'me' : ''}">
            <div style="display:flex; align-items:center; position:relative; z-index:2" onclick="window.toggleBox('${p.name}')">
                <div style="width:60px; height:60px; background:#333; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:30px; margin-right:15px;">
                    ${p.avatar || '👤'}
                </div>
                <div style="flex:1">
                    <div style="font-size:14px; opacity:0.6">${p.name}</div>
                    <div class="p-score" style="font-size:38px; font-weight:900;">${p.score}</div>
                </div>
            </div>
            <div class="transfer-area" id="box-${p.name}" style="display:none; flex-direction:column; gap:10px; margin-top:10px; padding:15px; background:rgba(255,255,255,0.1); border-radius:10px; position:relative; z-index:100;">
                <input type="number" id="in-${p.name}" placeholder="金额" inputmode="numeric" style="width:100%; padding:12px; font-size:20px; border:none; border-radius:8px; background:#fff; color:#000;">
                <button onclick="window.quickPay('${p.name}')" style="width:100%; padding:12px; background:#ffeb3b; color:#000; border:none; border-radius:8px; font-weight:900;">确认转账</button>
            </div>
        </div>
    `).join('');

    document.getElementById('logList').innerHTML = (history || []).slice().reverse().map(h => `
        <div style="padding:8px; font-size:12px; border-bottom:1px solid #444; color:#ccc">${h.time} | ${h.from} ➔ ${h.to} [${h.pts}]</div>
    `).join('');
}

window.toggleBox = function(name) {
    if (name === myName) return;
    const box = document.getElementById(`box-${name}`);
    const isShow = box.style.display === 'flex';
    document.querySelectorAll('.transfer-area').forEach(b => b.style.display = 'none');
    box.style.display = isShow ? 'none' : 'flex';
};

// --- 4. 绝杀：先读后写，解决平行时空 ---
window.quickPay = async function(target) {
    const inputEl = document.getElementById(`in-${target}`);
    const pts = parseInt(inputEl.value);
    if (!pts || pts <= 0) return;

    try {
        // A. 转账瞬间强行抓取云端最新数据
        let { data, error } = await mahjongDb.from('scores').select('*').eq('text', currentRoom).single();
        if (error) throw error;

        let players = data.player_data.map(p => {
            if (p.name === myName) p.score -= pts;
            if (p.name === target) p.score += pts;
            return p;
        });
        let history = data.history_data || [];
        history.push({ from: myName, to: target, pts: pts, time: new Date().toLocaleTimeString('zh-CN', {hour12:false, minute:'2-digit'}) });

        // B. 写回数据库，触发所有人的实时刷新
        const { error: updateError } = await mahjongDb.from('scores').update({ player_data: players, history_data: history }).eq('text', currentRoom);
        if (updateError) throw updateError;

        inputEl.value = "";
        document.getElementById(`box-${target}`).style.display = 'none';
    } catch (e) {
        alert("操作失败，请确认 Supabase 权限已放行！");
    }
};
