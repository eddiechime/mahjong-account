// 注意核对 URL 和 KEY
const SUPABASE_URL = 'https://iksfgmnvbyldhrrptiwv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_51l5etLAilmVdkptxlx-Wg_BbwqUrhA';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function joinRoom() {
    const room = document.getElementById('roomInput').value.trim();
    const user = document.getElementById('userInput').value.trim();
    
    if (!room || !user) {
        alert("请输入房间名和你的大名！");
        return;
    }

    try {
        console.log("正在尝试接入...");
        currentRoom = room;
        myName = user;
        localStorage.setItem('saved_name', user);

        // 核心：读取或初始化房间
        let { data, error } = await supabase.from('scores').select('*').eq('text', currentRoom).maybeSingle();
        
        if (error) throw error;

        const avatars = ['🀄️', '🧧', '🎰', '💎', '🤴', '👸', '🦁', '🐼'];
        let players = [];
        let history = [];

        if (!data) {
            // 新房
            players = [{name: myName, score: 0, avatar: avatars[Math.floor(Math.random()*avatars.length)]}];
            await supabase.from('scores').insert([{text: currentRoom, player_data: players, history_data: []}]);
        } else {
            // 老房
            players = data.player_data || [];
            history = data.history_data || [];
            if (!players.find(p => p.name === myName)) {
                players.push({name: myName, score: 0, avatar: avatars[Math.floor(Math.random()*avatars.length)]});
                await supabase.from('scores').update({player_data: players}).eq('text', currentRoom);
            }
        }

        // 成功进入，切换 UI
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('roomIdDisplay').innerText = currentRoom;
        renderUI(players, history);
        
        // 开启监听
        subscribeRoom();

    } catch (err) {
        console.error("连接失败:", err);
        alert("数据库连接失败，请确认 RLS 是否已关闭！");
    }
}
