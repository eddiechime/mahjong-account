// 主题切换逻辑
function changeTheme(themeName) {
    document.getElementById('mainBody').className = themeName;
    const slogan = document.getElementById('sloganText');
    const modalTitle = document.getElementById('modalTitle');

    // 针对“甄嬛传”风格的文案定制
    if (themeName === 'theme-palace') {
        slogan.innerText = "后宫生存不易，碎银也要算清";
        modalTitle.innerText = "赏赐小主：";
    } else if (themeName === 'theme-zen') {
        slogan.innerText = "谈钱不伤感情，承让笑纳";
    } else {
        slogan.innerText = "1块1局 · 拒绝内耗";
    }
}

// 独立界面：根据 URL 或缓存识别身份
let myName = localStorage.getItem('myName') || "匿名小主";
document.getElementById('roomIdDisplay').innerText = "孝南频道 888";

// 渲染玩家列表 (模拟数据)
const players = [
    { name: "甄嬛", score: 100 },
    { name: "安陵容", score: -50 },
    { name: "华妃", score: 200 }
];

function render() {
    const grid = document.getElementById('playerGrid');
    grid.innerHTML = players.map(p => `
        <div class="player-card" onclick="openModal('${p.name}')">
            <div class="avatar">${p.name[0]}</div>
            <h3>${p.name}</h3>
            <p class="score">${p.score}</p>
        </div>
    `).join('');
}

render();
function confirmPay() {
    const theme = document.body.className;
    const amount = document.getElementById('scoreInput').value;
    
    // 语音合成：模拟苏培盛宣旨
    if (theme === 'theme-palace') {
        const msg = new SpeechSynthesisUtterance(`奉天承运，皇帝诏曰：赏赐小主碎银${amount}两，钦此——`);
        msg.lang = 'zh-CN';
        msg.rate = 0.8; // 语速慢一点，更有宫廷感
        window.speechSynthesis.speak(msg);
        alert(`【内务府】碎银已到账`);
    } else {
        alert(`入账成功：${amount}`);
    }
    closeModal();
}