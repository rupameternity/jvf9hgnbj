const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();


const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is Active on Render! 🟢');
});

// '0.0.0.0' zaroori hai Render ke liye
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});

// --- BOT SETUP ---
const token = process.env.BOT_TOKEN;
if (!token) {
    console.error("❌ ERROR: BOT_TOKEN nahi mila! Environment Variables check karo.");
    process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });

// --- CONFIGURATION ---
const adminIds = [
    7096965198, 
    6429023830,
    8000227591,
    8487113041,
    6005670247,
    7916211456,
    8076555425,
    5248658367,
    8514126036,
    7476658546,
    6308953872,
    7409280726,
    6868586610,
    6463420275,
    5078407286
];


const ownerId = 7096965198; 

// --- VARIABLES ---
let listActive = false;
let listData = [];
let listMessageId = null;
let listChatId = null;
let listTitle = "Event List"; 
let updateTimer = null;

// Helpers
const isAdmin = (id) => adminIds.includes(Number(id));
const escapeHtml = (unsafe) => {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

// --- ⚡ FAST UPDATER (0.8s) ---
const scheduleListUpdate = () => {
    if (!listActive) return;
    if (updateTimer) clearTimeout(updateTimer);
    
    updateTimer = setTimeout(async () => {
        if (!listActive) return;
        try {
            await bot.editMessageText(generateListText(), {
                chat_id: listChatId,
                message_id: listMessageId,
                parse_mode: 'HTML',
                reply_markup: generateKeyboard()
            });
        } catch (e) {
            // Ignore small errors
        }
    }, 800); 
};

const generateListText = () => {
    let text = `📋 <b>${escapeHtml(listTitle)}</b>\n\n`;
    if (listData.length === 0) text += "Waiting for names...\n<i>(Type 'addlist Name' to join)</i>";
    else {
        listData.forEach((item, index) => {
            const safeName = escapeHtml(item.name);
            const status = item.ticked ? " ✅" : "";
            text += `${index + 1}. ${safeName}${status}\n\n`;
        });
    }
    return text;
};

const generateKeyboard = () => {
    if (!listActive) return { inline_keyboard: [] };
    const next = listData.find(item => !item.ticked);
    return next ? { inline_keyboard: [[{ text: `Tick ${next.name}`, callback_data: `tick_${next.userId}_${next.timestamp}` }]] } : { inline_keyboard: [] };
};

// ==========================================
// 🔴 STRICT COMMAND: /startlist
// ==========================================
bot.onText(/\/startlist(?:\s+(.+))?/, async (msg, match) => {
    if (Date.now() / 1000 - msg.date > 30) return;
    if (!isAdmin(msg.from.id)) return; 

    if (listActive) {
        return bot.sendMessage(msg.chat.id, "ongoing session listing detected, use /endlist to end current one.");
    }

    listActive = true;
    listData = []; 
    listTitle = match[1] || "New List";
    listChatId = msg.chat.id;

    const s = await bot.sendMessage(listChatId, generateListText(), { parse_mode: 'HTML', reply_markup: generateKeyboard() });
    listMessageId = s.message_id;

    // Fast Pin (Background)
    bot.pinChatMessage(listChatId, listMessageId).catch(e => {});
});

// ==========================================
// 🔴 STRICT COMMAND: /endlist
// ==========================================
bot.onText(/\/endlist/, async (msg, match) => {
    if (Date.now() / 1000 - msg.date > 30) return;
    if (!isAdmin(msg.from.id)) return;
    if (!listActive) return bot.sendMessage(msg.chat.id, "No active session to stop.");

    // 1. Report Generate
    const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    let report = `📊 **Session Report**\n📅 Date: ${time}\n📝 Title: ${listTitle}\n\n`;
    
    if (listData.length === 0) report += "No participants.";
    else {
        listData.forEach((u, i) => {
            const username = u.username ? `@${u.username}` : "null";
            report += `${i + 1}. ${u.name} | ${username} | ID: ${u.userId}\n`;
        });
    }

    // Fast Report Send
    bot.sendMessage(ownerId, report).catch(e => {});

    // 2. Close Session
    listActive = false; 
    if (updateTimer) clearTimeout(updateTimer); 

    // Fast Unpin
    bot.unpinChatMessage(listChatId, { message_id: listMessageId }).catch(() => {
        bot.unpinChatMessage(listChatId).catch(() => {});
    });

    bot.editMessageText(generateListText() + "\n🛑 <b>Session Closed</b>", {
        chat_id: listChatId,
        message_id: listMessageId,
        parse_mode: 'HTML'
    }).catch(e => {});

    bot.sendMessage(msg.chat.id, "listing stopped");
    listData = [];
});

// ==========================================
// 🟢 MEMBER ACTION: addlist
// ==========================================
bot.on('message', async (msg) => {
    if (!listActive || !msg.text) return;
    if (Date.now() / 1000 - msg.date > 30) return; 
    
    const text = msg.text.toLowerCase();
    if (!text.startsWith('addlist')) return;

    const parts = msg.text.split(' ');
    if (parts.length < 2) return;

    const name = parts.slice(1).join(' ');
    const userId = msg.from.id;
    const username = msg.from.username || null; 

    if (isAdmin(userId)) {
        listData.push({ name, userId, username, ticked: false, timestamp: Date.now() });
    } else {
        if (listData.find(u => u.userId === userId)) {
            return bot.sendMessage(msg.chat.id, "you are already is the queue", { reply_to_message_id: msg.message_id });
        }
        listData.push({ name, userId, username, ticked: false, timestamp: Date.now() });
    }

    scheduleListUpdate();
});

// ==========================================
// 🟢 ADMIN ACTION: Tick
// ==========================================
bot.on('callback_query', async (q) => {
    if (!listActive) return bot.answerCallbackQuery(q.id, { text: "Only Host!", show_alert: true });
    if (!isAdmin(q.from.id)) return bot.answerCallbackQuery(q.id, { text: "Admins Only!", show_alert: true });

    if (q.data.startsWith('tick_')) {
        const parts = q.data.split('_');
        const userId = parseInt(parts[1]);
        const timestamp = parseInt(parts[2]);
        const user = listData.find(u => u.userId === userId && u.timestamp === timestamp);
        if (user && !user.ticked) {
            user.ticked = true;
            scheduleListUpdate();
        }
        bot.answerCallbackQuery(q.id);
    }
});

bot.on('polling_error', (error) => {});
