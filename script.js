// --- 1. 初始化 Supabase 连接 ---
const SUPABASE_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ROOM_ID = '888888'; // 默认频道号
let myName = localStorage.getItem('myName') || prompt("请输入你的昵称 (如：思聪)", "思聪");
if (!localStorage.getItem('myName')) localStorage.setItem('myName', myName);

let currentPlayers = [];
let currentHistory = [];

// --- 2. 核心：联机监听 (Realtime) ---
supabase.channel('public:scores')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scores', filter: `room_id=eq.${ROOM_ID}` }, (payload) => {
    console.log('数据实时更新中...');
    refreshUI(payload.new.player_data, payload.new.history_data);
  })
  .subscribe();

// --- 3. 初始化读取数据 ---
async function init() {
    let { data, error } = await supabase.from('scores').select('*').eq('room_id', ROOM_ID).maybeSingle();
    
    if (!data) {
        // 如果房间不存在，自动初始化第一局
        const startPlayers = [{name:'思聪', score:0}, {name:'Lynn', score:0}, {name:'亲戚A', score:0}, {name:'亲戚B', score:0}];
        await supabase.from('scores').insert([{room_id: ROOM_ID, player_data: startPlayers, history_data: []}]);
        refreshUI(startPlayers, []);
    } else {
        refreshUI(data.player_data, data.history_data);
    }
    document.getElementById('roomIdDisplay').innerText = ROOM_ID;
}

// --- 4. 界面渲染逻辑 ---
function refreshUI(players, history) {
    currentPlayers = players;
    currentHistory = history || [];
    
    // 渲染大字号玩家卡片
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card" onclick="openModal('${p.name}')">
            <div class="avatar">${p.name[0]}</div>
            <div class="p-name">${p.name}${p.name === myName ? '(我)' : ''}</div>
            <div class="p-score ${p.score >= 0 ? 'plus' : 'minus'}">${p.score}</div>
        </div>
    `).join('');

    // 渲染流水记录
    const logList = document.getElementById('logList');
    logList.innerHTML = currentHistory.slice().reverse().map(h => `
        <div class="log-item">
            <span class="t">${h.time}</span> 
            <strong>${h.from}</strong> ▶ <strong>${h.to}</strong> 
            <span class="v">${h.points}金币</span>
        </div>
    `).join('');
}

let targetPlayer = '';
function openModal(name) {
    if (name === myName) return; // 不能给自己转账
    targetPlayer = name;
    document.getElementById('modalTitle').innerText = `向 ${name} 入账`;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// --- 5. 确认转账并同步云端 ---
async function confirmPay() {
    const input = document.getElementById('scoreInput');
    const val = parseInt(input.value);
    if (!val || val <= 0) return;

    // 计算新分数
    const nextPlayers = currentPlayers.map(p => {
        let s = p.score;
        if (p.name === myName) s -= val;
        if (p.name === targetPlayer) s += val;
        return { ...p, score: s };
    });

    // 记录流水
    const newLog = { 
        from: myName, to: targetPlayer, points: val, 
        time: new Date().toLocaleTimeString('zh-CN', {hour12:false, hour:'2-digit', minute:'2-digit'}) 
    };
    const nextHistory = [...currentHistory, newLog];

    // 同步到 Supabase
    const { error } = await supabase.from('scores')
        .update({ player_data: nextPlayers, history_data: nextHistory })
        .eq('room_id', ROOM_ID);

    if (!error) {
        input.value = '';
        closeModal();
        // 甄嬛传专属音效逻辑
        if (document.body.className === 'theme-palace') {
            const speak = new SpeechSynthesisUtterance(`赏赐${targetPlayer}碎银${val}两，收好了。`);
            speak.lang = 'zh-CN';
            window.speechSynthesis.speak(speak);
        }
    } else {
        alert("同步失败，请检查网络");
    }
}

// 主题切换函数
function changeTheme(theme) {
    document.getElementById('mainBody').className = theme;
    const slogan = document.getElementById('sloganText');
    if (theme === 'theme-palace') slogan.innerText = "后宫生存不易，碎银也要算清";
    else if (theme === 'theme-zen') slogan.innerText = "谈钱不伤感情，笑纳承让";
    else slogan.innerText = "1块1局 · 亲戚明算账";
}

init();
