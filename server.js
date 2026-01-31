const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

// --- SERVER KEEPALIVE ---
const port = process.env.PORT || 3000;
app.get('/', (req, res) => { res.send('Bot is Running with REMOVE & TICK Commands! 🛡️'); });
app.listen(port, '0.0.0.0', () => { console.log(`Server running on port ${port}`); });

// --- BOT SETUP ---
const token = process.env.BOT_TOKEN;
if (!token) { console.error("❌ ERROR: BOT_TOKEN missing!"); process.exit(1); }
const bot = new TelegramBot(token, { polling: true });

// --- CONFIGURATION ---
const adminIds = [ 7096965198, 6429023830, 8000227591, 7292074890, 8487113041, 6005670247, 7916211456, 8076555425, 5248658367, 8514126036, 7476658546, 6308953872, 7409280726, 6868586610, 6463420275, 5078407286];
const ownerId = 7096965198; 

// 🔴 CHANGE THIS (Apne Group IDs yahan daal)
const allowedGroups = [
    -1002562222456, 
    -1002693902733
];

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

// --- 🛡️ SECURITY GUARD ---
const checkGroupPermission = async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;

    if (chatType === 'private') {
        if (msg.from.id !== ownerId) return false; 
        return true;
    }
    if (chatType === 'group' || chatType === 'supergroup') {
        if (!allowedGroups.includes(chatId)) {
            try {
                await bot.sendMessage(chatId, "❌ **Access Denied:** I am not allowed in this group.");
                await bot.leaveChat(chatId);
            } catch (e) {}
            return false;
        }
    }
    return true; 
};

// --- ⚡ FAST UPDATER ---
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
        } catch (e) {}
    }, 800); 
};

const generateListText = () => {
    let text = ` <b>${escapeHtml(listTitle)}</b>\n\n`;
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
    // Logic: Find the FIRST item that is NOT ticked yet.
    const next = listData.find(item => !item.ticked);
    return next ? { inline_keyboard: [[{ text: `Tick ${next.name}`, callback_data: `tick_${next.userId}_${next.timestamp}` }]] } : { inline_keyboard: [] };
};

// ==========================================
// 🕶️ PRO OWNER COMMANDS
// ==========================================
bot.onText(/\/ten login/, async (msg) => {
    if (msg.from.id !== ownerId) return; 
    await bot.sendMessage(msg.chat.id, "sudo ten detected", { reply_to_message_id: msg.message_id });
});

bot.onText(/\/ten logsend/, async (msg) => {
    if (msg.from.id !== ownerId) return;
    await bot.sendMessage(msg.chat.id, "log sent", { reply_to_message_id: msg.message_id });
});

bot.onText(/\/updateai/, async (msg) => {
    if (msg.from.id !== ownerId) return;
    await bot.sendMessage(msg.chat.id, "updated tenai:aries.1b", { reply_to_message_id: msg.message_id });
});

bot.onText(/\who are you/, async (msg) => {
    if (msg.from.id !== ownerId) return; 
    await bot.sendMessage(msg.chat.id, "im an Ai chatbot made by and for ECC. i can create quizes, play games, list names and all. feel free to ask for help.", { reply_to_message_id: msg.message_id });
});

bot.onText(/\model/, async (msg) => {
    if (msg.from.id !== ownerId) return; 
    await bot.sendMessage(msg.chat.id, "sec 3 from tenai:aries.1b", { reply_to_message_id: msg.message_id });
});

bot.onText(/\/ten logout/, async (msg) => {
    if (msg.from.id !== ownerId) return; 
    await bot.sendMessage(msg.chat.id, "logged out", { reply_to_message_id: msg.message_id });
});

// ==========================================
// 🛠️ ADMIN TOOLS: REMOVE & TICK
// ==========================================

// 1. REMOVE Command (/remove 1)
bot.onText(/\/remove (\d+)/, async (msg, match) => {
    if (!(await checkGroupPermission(msg))) return;
    if (!isAdmin(msg.from.id)) return;
    if (!listActive) return bot.sendMessage(msg.chat.id, "❌ No active list.");

    const index = parseInt(match[1]) - 1; // Convert 1 to 0
    
    // Check if number is valid
    if (index < 0 || index >= listData.length) {
        return bot.sendMessage(msg.chat.id, "❌ Invalid number. Check list.");
    }

    const removedName = listData[index].name;
    // Remove user, list will auto-shift (1, 2, 3...)
    listData.splice(index, 1);
    
    scheduleListUpdate();
    bot.sendMessage(msg.chat.id, `🗑️ Removed: ${removedName}`);
});

// 2. TICK Command (/tick 1)
bot.onText(/\/tick (\d+)/, async (msg, match) => {
    if (!(await checkGroupPermission(msg))) return;
    if (!isAdmin(msg.from.id)) return;
    if (!listActive) return bot.sendMessage(msg.chat.id, "❌ No active list.");

    const index = parseInt(match[1]) - 1;

    if (index < 0 || index >= listData.length) {
        return bot.sendMessage(msg.chat.id, "❌ Invalid number.");
    }

    // Tick specific user
    listData[index].ticked = true;
    
    scheduleListUpdate();
    bot.sendMessage(msg.chat.id, `✅ Manually Ticked: ${listData[index].name}`);
});

// ==========================================
// 🔴 COMMAND: /startlist
// ==========================================
bot.onText(/\/startlist(?:\s+(.+))?/, async (msg, match) => {
    if (!(await checkGroupPermission(msg))) return;
    if (Date.now() / 1000 - msg.date > 30) return;
    if (!isAdmin(msg.from.id)) return; 

    if (listActive) return bot.sendMessage(msg.chat.id, "ongoing session listing detected, use /endlist to end current one.");

    listActive = true;
    listData = []; 
    listTitle = match[1] || "New List";
    listChatId = msg.chat.id;

    const s = await bot.sendMessage(listChatId, generateListText(), { parse_mode: 'HTML', reply_markup: generateKeyboard() });
    listMessageId = s.message_id;

    bot.pinChatMessage(listChatId, listMessageId).catch(e => {});
});

// ==========================================
// 🔴 COMMAND: /endlist
// ==========================================
bot.onText(/\/endlist/, async (msg, match) => {
    if (!(await checkGroupPermission(msg))) return;
    if (Date.now() / 1000 - msg.date > 30) return;
    if (!isAdmin(msg.from.id)) return;
    if (!listActive) return bot.sendMessage(msg.chat.id, "No active session to stop.");

    // Report
    const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    let report = `📊 **Session Report**\n📅 Date: ${time}\n📝 Title: ${listTitle}\n\n`;
    if (listData.length === 0) report += "No participants.";
    else {
        listData.forEach((u, i) => {
            const username = u.username ? `@${u.username}` : "null";
            report += `${i + 1}. ${u.name} | ${username} | ID: ${u.userId}\n`;
        });
    }
    bot.sendMessage(ownerId, report).catch(e => {});

    listActive = false; 
    if (updateTimer) clearTimeout(updateTimer); 

    bot.unpinChatMessage(listChatId, { message_id: listMessageId }).catch(() => {});
    bot.editMessageText(generateListText() + "\n🛑 <b>Session Closed</b>", {
        chat_id: listChatId,
        message_id: listMessageId,
        parse_mode: 'HTML'
    }).catch(e => {});

    bot.sendMessage(msg.chat.id, "listing stopped");
    listData = [];
});

// ==========================================
// 🟢 COMMAND: addlist (Updated with Reply)
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    if ((chatType === 'group' || chatType === 'supergroup') && !allowedGroups.includes(chatId)) return;
    if (chatType === 'private') return;

    if (!listActive || !msg.text) return;
    if (Date.now() / 1000 - msg.date > 30) return; 
    
    const text = msg.text.toLowerCase();
    if (!text.startsWith('addlist')) return;

    const parts = msg.text.split(' ');
    if (parts.length < 2) return;

    const name = parts.slice(1).join(' ');
    const userId = msg.from.id;
    const username = msg.from.username || null; 

    // Admin multiple times add kar sakta hai, Normal user sirf 1 baar
    if (isAdmin(userId)) {
        listData.push({ name, userId, username, ticked: false, timestamp: Date.now() });
        bot.sendMessage(msg.chat.id, `added ${name}`, { reply_to_message_id: msg.message_id });
    } else {
        if (listData.find(u => u.userId === userId)) {
            return bot.sendMessage(msg.chat.id, "You are already in the queue", { reply_to_message_id: msg.message_id });
        }
        listData.push({ name, userId, username, ticked: false, timestamp: Date.now() });
        bot.sendMessage(msg.chat.id, `added ${name}`, { reply_to_message_id: msg.message_id });
    }

    scheduleListUpdate();
});

// ==========================================
// 🟢 BUTTON ACTION
// ==========================================
bot.on('callback_query', async (q) => {
    if (!listActive) return bot.answerCallbackQuery(q.id, { text: "Closed!", show_alert: true });
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

// --- CRASH HANDLER ---
bot.on('my_chat_member', async (msg) => {
    if (msg.new_chat_member.status === 'member' || msg.new_chat_member.status === 'administrator') {
        const chatId = msg.chat.id;
        console.log(`✅ BOT JOINED NEW GROUP: ${msg.chat.title} | ID: ${chatId}`); 
        if (!allowedGroups.includes(chatId)) {
            await bot.sendMessage(chatId, "❌ **Access Denied:** I am not allowed in this group.");
            await bot.leaveChat(chatId);
        }
    }
});
bot.on('polling_error', (error) => console.log(`[Polling Error] ${error.code || 'Unknown'}: ${error.message}`));
bot.on('webhook_error', (error) => console.log(`[Webhook Error] ${error.code}: ${error.message}`));
process.on('uncaughtException', (err) => console.log('Uncaught Exception:', err.message));
