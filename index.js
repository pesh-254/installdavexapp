require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');
const os = require('os');
const chalk = require('chalk');
const { 
    makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    delay,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");

// Telegram bot setup
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL || '@DavexTech';
const REQUIRED_GROUP = process.env.REQUIRED_GROUP || '@Davexgroupchart';

if (!telegramToken) {
    console.error(chalk.red.bold('Telegram bot token is not set.'));
    process.exit(1);
}

const bot = new TelegramBot(telegramToken, { polling: true });
const pairingCodes = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const requestLimits = new NodeCache({ stdTTL: 120, checkperiod: 60 });

// --- Core WhatsApp Bot Dependencies ---
let smsg, handleMessages, handleGroupParticipantUpdate, handleStatus, store, settings;
const antiCallNotified = new Set();

// --- Paths ---
const connectedUsersFilePath = path.join(__dirname, 'queen/connectedUsers.json');
const sessionBasePath = path.join(__dirname, 'trash_baileys');
const MESSAGE_STORE_FILE = path.join(__dirname, 'message_backup.json');
const SESSION_ERROR_FILE = path.join(__dirname, 'sessionErrorCount.json');

// Ensure directories exist
if (!fs.existsSync(sessionBasePath)) fs.mkdirSync(sessionBasePath, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'queen'))) fs.mkdirSync(path.join(__dirname, 'queen'), { recursive: true });

// --- Global Variables ---
global.messageBackup = {};
global.isBotConnected = false;
global.errorRetryCount = 0;
global.botname = "DAVE X";
global.themeemoji = "•";

// Track Telegram users
let userIds = [];
let users = {};

// --- Message Storage Functions ---
function loadStoredMessages() {
    try {
        if (fs.existsSync(MESSAGE_STORE_FILE)) {
            const data = fs.readFileSync(MESSAGE_STORE_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error(chalk.red(`Error loading message backup: ${error.message}`));
    }
    return {};
}

function saveStoredMessages(data) {
    try {
        fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(chalk.red(`Error saving message backup: ${error.message}`));
    }
}

function deleteErrorCountFile() {
    try {
        if (fs.existsSync(SESSION_ERROR_FILE)) {
            fs.unlinkSync(SESSION_ERROR_FILE);
            console.log(chalk.green('Deleted sessionErrorCount.json'));
        }
    } catch (e) {
        console.error(chalk.red(`Failed to delete error file: ${e.message}`));
    }
}

// Load initial data
global.messageBackup = loadStoredMessages();

// --- Connected Users Management ---
let connectedUsers = {};
function loadConnectedUsers() {
    try {
        if (fs.existsSync(connectedUsersFilePath)) {
            const data = fs.readFileSync(connectedUsersFilePath, 'utf-8');
            connectedUsers = JSON.parse(data);
            console.log(chalk.green(`Loaded ${Object.keys(connectedUsers).length} connected users`));
        }
    } catch (error) {
        console.error(chalk.red('Error loading connected users:', error));
    }
}

function saveConnectedUsers() {
    try {
        fs.writeFileSync(connectedUsersFilePath, JSON.stringify(connectedUsers, null, 2));
    } catch (error) {
        console.error(chalk.red('Error saving connected users:', error));
    }
}

// --- Membership Check ---
async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(REQUIRED_CHANNEL, userId);
        const groupMember = await bot.getChatMember(REQUIRED_GROUP, userId);

        const isChannelMember = ['member', 'administrator', 'creator'].includes(channelMember.status);
        const isGroupMember = ['member', 'administrator', 'creator'].includes(groupMember.status);

        return { isChannelMember, isGroupMember, bothJoined: isChannelMember && isGroupMember };
    } catch (error) {
        console.error(chalk.red('Error checking membership:', error));
        return { isChannelMember: false, isGroupMember: false, bothJoined: false };
    }
}

// --- WhatsApp Bot Manager Class ---
class WhatsAppBotManager {
    constructor() {
        this.connections = new Map();
        this.activeConnections = new Map();
    }

    // Load WhatsApp bot dependencies
    async loadWhatsAppDependencies() {
        try {
            if (!fs.existsSync('./settings.js')) {
                console.log(chalk.yellow('settings.js not found, creating default...'));
                fs.writeFileSync('./settings.js', 'module.exports = {};');
            }

            if (!fs.existsSync('./main.js')) {
                console.log(chalk.yellow('main.js not found'));
                return false;
            }

            require('./settings');
            const mainModules = require('./main');

            if (mainModules.handleMessages) {
                handleMessages = mainModules.handleMessages;
            } else {
                console.log(chalk.yellow('handleMessages not found in main.js'));
                handleMessages = () => console.log('Message handler not available');
            }

            if (mainModules.handleGroupParticipantUpdate) {
                handleGroupParticipantUpdate = mainModules.handleGroupParticipantUpdate;
            } else {
                handleGroupParticipantUpdate = () => {};
            }

            if (mainModules.handleStatus) {
                handleStatus = mainModules.handleStatus;
            } else {
                handleStatus = () => {};
            }

            // Try to load myfunc
            try {
                if (fs.existsSync('./lib/myfunc.js')) {
                    const myfuncModule = require('./lib/myfunc');
                    smsg = myfuncModule.smsg;
                } else {
                    console.log(chalk.yellow('myfunc.js not found'));
                    smsg = {};
                }
            } catch (e) {
                console.log(chalk.yellow('Error loading myfunc:', e.message));
                smsg = {};
            }

            // Try to load store
            try {
                if (fs.existsSync('./lib/lightweight_store.js')) {
                    store = require('./lib/lightweight_store');
                    if (store.readFromFile) store.readFromFile();
                } else {
                    console.log(chalk.yellow('lightweight_store.js not found'));
                    store = {};
                }
            } catch (e) {
                console.log(chalk.yellow('Error loading store:', e.message));
                store = {};
            }

            settings = require('./settings');

            // Auto-save store periodically
            if (store.writeToFile) {
                setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);
            }

            console.log(chalk.green('WhatsApp bot dependencies loaded successfully.'));
            return true;
        } catch (error) {
            console.error(chalk.red(`Failed to load WhatsApp dependencies: ${error.message}`));
            return false;
        }
    }

    // Create WhatsApp connection
    async createConnection(phoneNumber, telegramChatId) {
        const sessionPath = path.join(sessionBasePath, `session_${phoneNumber}`);

        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        try {
            const { version } = await fetchLatestBaileysVersion();
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const msgRetryCounterCache = new NodeCache();

            const conn = makeWASocket({
                version: [2, 3000, 1027934701],
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: ["Ubuntu", "Chrome", "20.0.00"],
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                msgRetryCounterCache,
                defaultQueryTimeoutMs: undefined,
            });

            // Bind store if available
            if (store && store.bind) {
                store.bind(conn.ev);
            }

            // --- MESSAGE UPSERT HANDLER ---
            conn.ev.on('messages.upsert', async chatUpdate => {
                try {
                    for (const msg of chatUpdate.messages) {
                        if (!msg.message) continue;
                        let chatId = msg.key.remoteJid;
                        let messageId = msg.key.id;
                        if (!global.messageBackup[chatId]) { 
                            global.messageBackup[chatId] = {}; 
                        }
                        let textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || null;
                        if (!textMessage) continue;
                        let savedMessage = { 
                            sender: msg.key.participant || msg.key.remoteJid, 
                            text: textMessage, 
                            timestamp: msg.messageTimestamp 
                        };
                        if (!global.messageBackup[chatId][messageId]) { 
                            global.messageBackup[chatId][messageId] = savedMessage; 
                            saveStoredMessages(global.messageBackup); 
                        }
                    }

                    const mek = chatUpdate.messages[0];
                    if (!mek.message) return;
                    mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? 
                        mek.message.ephemeralMessage.message : mek.message;

                    if (mek.key.remoteJid === 'status@broadcast' && handleStatus) { 
                        await handleStatus(conn, chatUpdate); 
                        return; 
                    }

                    if (handleMessages) { 
                        await handleMessages(conn, chatUpdate, true); 
                    }
                } catch(e) { 
                    console.error(chalk.red(`Message handler error: ${e.message}`)); 
                }
            });

            // --- CALL HANDLER ---
            conn.ev.on('call', async (calls) => {
                try {
                    let anticallState = { enabled: false };
                    try {
                        if (fs.existsSync('./Commands/anticall.js')) {
                            const anticallModule = require('./Commands/anticall');
                            if (anticallModule.readState) {
                                anticallState = anticallModule.readState();
                            }
                        }
                    } catch (e) {}

                    if (!anticallState.enabled) return;

                    for (const call of calls) {
                        const callerJid = call.from || call.peerJid || call.chatId;
                        if (!callerJid) continue;

                        try {
                            if (typeof conn.rejectCall === 'function' && call.id) {
                                await conn.rejectCall(call.id, callerJid);
                            }
                        } catch {}

                        if (!antiCallNotified.has(callerJid)) {
                            antiCallNotified.add(callerJid);
                            setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                            try {
                                await conn.sendMessage(callerJid, { 
                                    text: 'Anticall is enabled. Your call was rejected.' 
                                });
                            } catch {}
                        }

                        setTimeout(async () => {
                            try { 
                                if (conn.updateBlockStatus) {
                                    await conn.updateBlockStatus(callerJid, 'block'); 
                                }
                            } catch {}
                        }, 800);
                    }
                } catch (e) {
                    // ignore
                }
            });

            // --- CONNECTION UPDATE HANDLER ---
            conn.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    await saveCreds();
                    console.log(chalk.green(`WhatsApp connected: ${phoneNumber}`));

                    if (!connectedUsers[telegramChatId]) {
                        connectedUsers[telegramChatId] = [];
                    }

                    const existingIndex = connectedUsers[telegramChatId].findIndex(u => u.phoneNumber === phoneNumber);
                    if (existingIndex === -1) {
                        connectedUsers[telegramChatId].push({ 
                            phoneNumber, 
                            connectedAt: new Date().toISOString(),
                            status: 'online'
                        });
                    } else {
                        connectedUsers[telegramChatId][existingIndex].status = 'online';
                        connectedUsers[telegramChatId][existingIndex].lastConnected = new Date().toISOString();
                    }
                    saveConnectedUsers();

                    // Send welcome message
                    await this.sendWelcomeMessage(conn, phoneNumber, telegramChatId);

                } else if (connection === 'close') {
                    console.log(chalk.yellow(`WhatsApp disconnected: ${phoneNumber}`));

                    if (connectedUsers[telegramChatId]) {
                        const userIndex = connectedUsers[telegramChatId].findIndex(u => u.phoneNumber === phoneNumber);
                        if (userIndex !== -1) {
                            connectedUsers[telegramChatId][userIndex].status = 'offline';
                            connectedUsers[telegramChatId][userIndex].lastDisconnected = new Date().toISOString();
                            saveConnectedUsers();
                        }
                    }

                    if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                        setTimeout(() => {
                            this.createConnection(phoneNumber, telegramChatId);
                        }, 5000);
                    }
                }
            });

            conn.ev.on('creds.update', saveCreds);

            this.connections.set(phoneNumber, { conn, telegramChatId, phoneNumber });
            this.activeConnections.set(phoneNumber, conn);

            return conn;

        } catch (error) {
            console.error(chalk.red(`Error creating connection for ${phoneNumber}:`, error));
            throw error;
        }
    }

    // --- WELCOME MESSAGE FUNCTION ---
    async sendWelcomeMessage(conn, phoneNumber, telegramChatId) {
        if (global.isBotConnected) return; 

        await delay(2000);

        const detectPlatform = () => {
            if (process.env.DYNO) return "Heroku";
            if (process.env.RENDER) return "Render";
            if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "Termux";
            if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return "CypherX";
            if (process.env.P_SERVER_UUID) return "Panel";
            if (process.env.LXC) return "Linux Container";

            switch (os.platform()) {
                case "win32": return "Windows";
                case "darwin": return "macOS";
                case "linux": return "Linux";
                default: return "Unknown";
            }
        };

        const hostName = detectPlatform();

        try {
            global.isBotConnected = true;
            const pNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';

            let isPublic = true;
            try {
                if (fs.existsSync('./data/messageCount.json')) {
                    const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                    isPublic = data.isPublic !== false;
                }
            } catch (e) {
                console.log(chalk.yellow('Could not load messageCount.json'));
            }

            const currentMode = isPublic ? 'public' : 'private';

            let prefix = '.';
            try {
                if (fs.existsSync('./commands/setprefix.js')) {
                    const setprefixModule = require('./commands/setprefix');
                    if (setprefixModule.getPrefix) {
                        prefix = setprefixModule.getPrefix();
                    }
                }
            } catch (e) {
                console.log(chalk.yellow('Could not load setprefix module'));
            }

            global.sock = conn;

            const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
            const time = new Date().toLocaleString();

            try {
                await conn.sendMessage(botNumber, {
                    text: `
╔═══════════════════╗
║   DAVE-X CONNECTED   ║
╚═══════════════════╝

🔹 Prefix: [${prefix}]
🔹 Mode: ${currentMode}
🔹 Platform: ${hostName}
🔹 Bot: DAVE-X
🔹 Status: Active
🔹 Time: ${time}
🔹 Telegram: t.me/Digladoo

━━━━━━━━━━━━━━━━━━━
✅ Ready to use!
`
                });
                console.log(chalk.green('Startup message sent.'));
            } catch (error) {
                console.error(chalk.red('Could not send startup message:', error.message));
            }

            // Send success message to Telegram
            const successMessage = `
╔═══════════════════╗
║  ✅ CONNECTION SUCCESS  ║
╚═══════════════════╝

📱 *Phone Number:* \`${phoneNumber}\`
⏰ *Time:* ${moment().format('HH:mm:ss')}
📅 *Date:* ${moment().format('DD/MM/YYYY')}
🔗 *Connection ID:* ${phoneNumber}

━━━━━━━━━━━━━━━━━━━
🎉 *Your WhatsApp is now connected!*
━━━━━━━━━━━━━━━━━━━

💡 *Need help?* Contact: @Digladoo
`;

            const opts = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📋 List Connections", callback_data: "list_my_connections" }],
                        [{ text: "❌ Disconnect", callback_data: `disconnect_${phoneNumber}` }],
                        [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                    ]
                }
            };
            
            bot.sendMessage(telegramChatId, successMessage, opts);

            // Follow newsletter and join group - AUTOJOIN FEATURES
            await delay(1000);
            try {
                await conn.newsletterFollow('120363400480173280@newsletter');
                console.log(chalk.green('[DAVE-X] ✅ Newsletter followed'));
            } catch (err) {
                console.log(chalk.yellow(`[DAVE-X] ⚠️ Newsletter failed: ${err.message}`));
            }

            await delay(1000);
            try {
                await conn.groupAcceptInvite('KiNnMy4plNd4gSIFMlf4dg');
                console.log(chalk.green('[DAVE-MD] ✅ Group invite accepted'));
            } catch (err) {
                console.log(chalk.yellow(`[DAVE-MD] ⚠️ Group invite failed: ${err.message}`));
            }

            // Reset error counter
            deleteErrorCountFile();
            global.errorRetryCount = 0;

        } catch (e) {
            console.error(chalk.red(`Error sending welcome message: ${e.message}`));
            global.isBotConnected = false;
        }
    }

    // Request pairing code
    async requestPairingCode(phoneNumber, telegramChatId) {
        try {
            const conn = await this.createConnection(phoneNumber, telegramChatId);

            setTimeout(async () => {
                try {
                    let code = await conn.requestPairingCode(phoneNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;

                    pairingCodes.set(code, { 
                        phoneNumber, 
                        telegramChatId,
                        requestedAt: new Date().toISOString() 
                    });

                    const pairingMessage = `
╔═══════════════════╗
║   🔐 PAIRING CODE   ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
🔢 *Code:* \`${code}\`
⏳ *Expires:* 1 hour

━━━━━━━━━━━━━━━━━━━
📝 *How to use:*
1. Open WhatsApp
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Enter code above
━━━━━━━━━━━━━━━━━━━
`;

                    bot.sendMessage(telegramChatId, pairingMessage, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "📋 Copy Code", callback_data: `copy_${code.replace(/-/g, '')}` }],
                                [{ text: "🔄 Regenerate", callback_data: `regenerate_${phoneNumber}` }],
                                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                            ]
                        }
                    });

                } catch (error) {
                    console.error(chalk.red(`Error getting pairing code:`, error));
                    bot.sendMessage(telegramChatId, '❌ Failed to generate pairing code. Please try again.');
                }
            }, 1500);

        } catch (error) {
            console.error(chalk.red(`Error in pairing process:`, error));
            throw error;
        }
    }

    // Disconnect WhatsApp
    disconnect(phoneNumber) {
        const connection = this.connections.get(phoneNumber);
        if (connection) {
            try {
                if (connection.conn.logout) connection.conn.logout();
                if (connection.conn.ws) connection.conn.ws.close();
                this.connections.delete(phoneNumber);
                this.activeConnections.delete(phoneNumber);

                const sessionPath = path.join(sessionBasePath, `session_${phoneNumber}`);
                if (fs.existsSync(sessionPath)) {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }

                return true;
            } catch (error) {
                console.error(chalk.red(`Error disconnecting ${phoneNumber}:`, error));
                return false;
            }
        }
        return false;
    }

    getConnection(phoneNumber) {
        return this.connections.get(phoneNumber);
    }

    getAllConnections() {
        return Array.from(this.connections.values());
    }

    // Broadcast message to all connected users
    async broadcastMessage(message) {
        const results = [];
        for (const [phoneNumber, connection] of this.connections.entries()) {
            try {
                await connection.conn.sendMessage(connection.conn.user.id, { text: message });
                results.push({ phoneNumber, status: 'success' });
            } catch (error) {
                results.push({ phoneNumber, status: 'failed', error: error.message });
            }
        }
        return results;
    }
}

// Initialize manager
const whatsappManager = new WhatsAppBotManager();

// Load WhatsApp dependencies
whatsappManager.loadWhatsAppDependencies().then(success => {
    if (!success) {
        console.log(chalk.yellow('WhatsApp dependencies not fully loaded, running in limited mode'));
    }
});

// ================ TELEGRAM BOT COMMANDS ================

bot.on('text', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username;
    const command = text.split(' ')[0].toLowerCase();
    if (command.startsWith('/')) {
        console.log(chalk.green(`Command: ${command} | User: @${username || 'no-username'} | ID: ${chatId}`));
    }
});

bot.on('message', (msg) => {
    const userId = msg.from.id;
    if (!users[userId]) {
        users[userId] = msg.from;
    }
    if (!userIds.includes(msg.chat.id)) {
        userIds.push(msg.chat.id);
    }
});

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const welcomeMessage = `
╔═══════════════════╗
║     DAVEX-MINI    ║
╚═══════════════════╝

📱 *WhatsApp Pairing Bot*
━━━━━━━━━━━━━━━━━━━

✨ *Available Commands:*

📱 /pair - Connect WhatsApp
🗑 /delpair - Disconnect session
📋 /listpaired - View connections
⏱ /uptime - Check bot uptime
🆔 /getmyid - Get your ID
📊 /botinfo - Bot statistics
🏓 /ping - Check bot speed
📢 /broadcast - Admin broadcast

━━━━━━━━━━━━━━━━━━━
💡 *Developed by @Digladoo*
`;

    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [{ text: "📱 Pair WhatsApp", callback_data: "pair_info" }],
                [{ text: "📋 My Connections", callback_data: "list_my_connections" }],
                [{ text: "ℹ️ Bot Info", callback_data: "bot_info" }],
                [
                    { text: "💬 Group", url: "https://t.me/Davexgroupchart" },
                    { text: "📢 Channel", url: "https://t.me/DavexTech" }
                ]
            ]
        }
    });
});

// /pair command - FIXED WITH SESSION CHECK
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const phoneNumber = match[1].trim();

    // Check if user has reached rate limit (2 minutes)
    const userKey = `${userId}_${phoneNumber}`;
    if (requestLimits.has(userKey)) {
        bot.sendMessage(chatId, `
╔═══════════════════╗
║  ⏳ PLEASE WAIT    ║
╚═══════════════════╝

❌ *You requested a code recently*

📱 *Number:* \`${phoneNumber}\`
⏰ *Wait:* 2 minutes

━━━━━━━━━━━━━━━━━━━
💡 *Please wait before requesting again*
        `, { parse_mode: 'Markdown' });
        return;
    }

    // Check membership
    const membership = await checkMembership(userId);
    if (!membership.bothJoined) {
        const missingText = `
╔═══════════════════╗
║  ⚠️ ACCESS DENIED   ║
╚═══════════════════╝

❌ *You must join both:*

${!membership.isChannelMember ? '📢 Channel: @DavexTech' : '✅ Channel: Joined'}
${!membership.isGroupMember ? '💬 Group: @Davexgroupchart' : '✅ Group: Joined'}

━━━━━━━━━━━━━━━━━━━
*Please join both to continue!*
`;

        const joinOpts = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📢 Join Channel", url: `https://t.me/${REQUIRED_CHANNEL.replace('@', '')}` }],
                    [{ text: "💬 Join Group", url: `https://t.me/${REQUIRED_GROUP.replace('@', '')}` }],
                    [{ text: "✅ I Joined, Try Again", callback_data: "verify_membership" }]
                ]
            }
        };

        bot.sendMessage(chatId, missingText, joinOpts);
        return;
    }

    // Validate phone number
    if (!phoneNumber.match(/^\d{10,15}$/)) {
        bot.sendMessage(chatId, `
╔═══════════════════╗
║  ❌ INVALID FORMAT  ║
╚═══════════════════╝

*Please provide a valid phone number:*

✅ *Correct:* \`2547xxxxxxxx\`
❌ *Wrong:* \`+2547xxxxxxx\`
❌ *Wrong:* \`07xxxxxx\`

━━━━━━━━━━━━━━━━━━━
⚠️ *No + or 0 prefix needed!*
        `, { parse_mode: 'Markdown' });
        return;
    }

    // Check if session already exists
    const sessionPath = path.join(sessionBasePath, `session_${phoneNumber}`);
    if (fs.existsSync(sessionPath)) {
        // Check if already connected to this user
        if (connectedUsers[chatId]) {
            const existing = connectedUsers[chatId].find(u => u.phoneNumber === phoneNumber);
            if (existing && existing.status === 'online') {
                bot.sendMessage(chatId, `
╔═══════════════════╗
║  ⚠️ ALREADY CONNECTED  ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
✅ *Status:* Already connected to your account

━━━━━━━━━━━━━━━━━━━
💡 *Use /delpair to disconnect first.*
                `, { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🗑 Disconnect", callback_data: `disconnect_${phoneNumber}` }],
                            [{ text: "📋 My Connections", callback_data: "list_my_connections" }]
                        ]
                    }
                });
                return;
            }
        }
        
        // Session exists but not connected to this user
        bot.sendMessage(chatId, `
╔═══════════════════╗
║  ℹ️ SESSION EXISTS  ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
📁 *Status:* Session file already exists

*This usually means:*
• Another user is using this number
• You disconnected but session wasn't deleted
• Previous pairing attempt failed

*Options:*
1. Use /delpair to remove existing session
2. Then pair again with /pair

━━━━━━━━━━━━━━━━━━━
        `, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🗑 Delete Session", callback_data: `disconnect_${phoneNumber}` }],
                    [{ text: "📋 My Connections", callback_data: "list_my_connections" }]
                ]
            }
        });
        return;
    }

    // Set rate limit (2 minutes)
    requestLimits.set(userKey, true);

    // Start pairing process
    bot.sendMessage(chatId, `
╔═══════════════════╗
║  🔄 PROCESSING...  ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
⏳ *Status:* Generating pairing code...

━━━━━━━━━━━━━━━━━━━
*Please wait 2-3 seconds...*
    `, { parse_mode: 'Markdown' });

    try {
        await whatsappManager.requestPairingCode(phoneNumber, chatId);
    } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message || 'Unknown error'}`);
        requestLimits.del(userKey);
    }
});

// /delpair command
bot.onText(/\/delpair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phoneNumber = match[1]?.trim();

    if (!phoneNumber) {
        bot.sendMessage(chatId, `
╔═══════════════════╗
║  ❌ INVALID FORMAT  ║
╚═══════════════════╝

*Please provide a phone number:*

✅ *Example:* \`/delpair 2547xxxxxx\`

━━━━━━━━━━━━━━━━━━━
        `, { parse_mode: 'Markdown' });
        return;
    }

    const success = whatsappManager.disconnect(phoneNumber);

    if (success) {
        if (connectedUsers[chatId]) {
            connectedUsers[chatId] = connectedUsers[chatId].filter(u => u.phoneNumber !== phoneNumber);
            if (connectedUsers[chatId].length === 0) {
                delete connectedUsers[chatId];
            }
            saveConnectedUsers();
        }

        bot.sendMessage(chatId, `
╔═══════════════════╗
║  ✅ DISCONNECTED   ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
✅ *Status:* Session removed successfully

━━━━━━━━━━━━━━━━━━━
💡 *You can now pair again with /pair*
        `, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📱 Pair Again", callback_data: "pair_info" }],
                    [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                ]
            }
        });
    } else {
        bot.sendMessage(chatId, `
╔═══════════════════╗
║  ❌ NOT FOUND      ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
❌ *Status:* No active session found

━━━━━━━━━━━━━━━━━━━
        `, { parse_mode: 'Markdown' });
    }
});

// /listpaired command
bot.onText(/\/listpaired/, (msg) => {
    const chatId = msg.chat.id;
    const userConnections = connectedUsers[chatId] || [];

    if (userConnections.length === 0) {
        bot.sendMessage(chatId, `
╔═══════════════════╗
║  📱 NO CONNECTIONS  ║
╚═══════════════════╝

❌ *You don't have any connected WhatsApp numbers.*

━━━━━━━━━━━━━━━━━━━
💡 *Use /pair to connect one.*
        `, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📱 Pair WhatsApp", callback_data: "pair_info" }],
                    [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                ]
            }
        });
        return;
    }

    let connectionList = `
╔═══════════════════╗
║  📱 MY CONNECTIONS  ║
╚═══════════════════╝

`;

    userConnections.forEach((conn, index) => {
        const status = conn.status === 'online' ? '🟢 Online' : '🔴 Offline';
        const timeAgo = conn.connectedAt ? moment(conn.connectedAt).fromNow() : 'N/A';
        connectionList += `${index + 1}. ${status} \`${conn.phoneNumber}\`\n   📅 ${timeAgo}\n\n`;
    });

    connectionList += `━━━━━━━━━━━━━━━━━━━\n📊 *Total:* ${userConnections.length} connection(s)`;

    const buttons = userConnections.map(conn => [
        { text: `❌ Disconnect ${conn.phoneNumber}`, callback_data: `disconnect_${conn.phoneNumber}` }
    ]);
    buttons.push([{ text: "🔄 Refresh", callback_data: "refresh_connections" }]);
    buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);

    bot.sendMessage(chatId, connectionList, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: buttons
        }
    });
});

// /botinfo command
bot.onText(/\/botinfo/, (msg) => {
    const chatId = msg.chat.id;
    const uptime = process.uptime();
    const days = Math.floor(uptime / (60 * 60 * 24));
    const hours = Math.floor((uptime % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((uptime % (60 * 60)) / 60);

    const totalConnections = Object.values(connectedUsers).reduce((acc, curr) => acc + curr.length, 0);
    const activeConnectionsCount = whatsappManager.getAllConnections().length;

    const infoText = `
╔═══════════════════╗
║   📊 BOT INFO      ║
╚═══════════════════╝

⏱ *Uptime:* ${days}d ${hours}h ${minutes}m
👥 *Users:* ${userIds.length}
🔗 *Connections:* ${totalConnections}
🟢 *Active:* ${activeConnectionsCount}
📡 *Status:* Online ✅

━━━━━━━━━━━━━━━━━━━
🛠 *Developer:* @Digladoo
📦 *Version:* 2.0.0
🌐 *Platform:* Node.js
━━━━━━━━━━━━━━━━━━━
`;

    bot.sendMessage(chatId, infoText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "💬 Support", url: "https://t.me/Davexgroupchart" },
                    { text: "📢 Updates", url: "https://t.me/DavexTech" }
                ],
                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
            ]
        }
    });
});

// /ping command
bot.onText(/\/ping/, async (msg) => {
    const chatId = msg.chat.id;
    const start = Date.now();
    const sent = await bot.sendMessage(chatId, '🏓 *Pinging...*', { parse_mode: 'Markdown' });
    const end = Date.now();
    const responseTime = end - start;

    bot.editMessageText(
        `
╔═══════════════════╗
║   🏓 PONG!         ║
╚═══════════════════╝

⚡ *Speed:* ${responseTime}ms
📡 *Status:* Online ✅

━━━━━━━━━━━━━━━━━━━
💡 *Bot is responding normally*
        `,
        {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: 'Markdown'
        }
    );
});

// /uptime command
bot.onText(/\/uptime/, (msg) => {
    const chatId = msg.chat.id;
    const uptime = process.uptime();
    const days = Math.floor(uptime / (60 * 60 * 24));
    const hours = Math.floor((uptime % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((uptime % (60 * 60)) / 60);
    const seconds = Math.floor(uptime % 60);

    const uptimeMessage = `
╔═══════════════════╗
║   ⏱ BOT UPTIME    ║
╚═══════════════════╝

📆 *Days:* ${days}
🕐 *Hours:* ${hours}
⏰ *Minutes:* ${minutes}
⏱ *Seconds:* ${seconds}

━━━━━━━━━━━━━━━━━━━
✅ *Status:* Running Smoothly
━━━━━━━━━━━━━━━━━━━
`;

    bot.sendMessage(chatId, uptimeMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
            ]
        }
    });
});

// /getmyid command
bot.onText(/\/getmyid/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username ? `@${msg.from.username}` : 'No username';

    const idMessage = `
╔═══════════════════╗
║   👤 YOUR INFO     ║
╚═══════════════════╝

🆔 *ID:* \`${userId}\`
📝 *Username:* ${username}
👤 *Name:* ${msg.from.first_name || 'N/A'}

━━━━━━━━━━━━━━━━━━━
💡 *Save this ID for support requests*
━━━━━━━━━━━━━━━━━━━
`;

    bot.sendMessage(chatId, idMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
            ]
        }
    });
});

// /broadcast command (Admin only)
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const message = match[1].trim();

    const OWNER_ID = process.env.OWNER_ID || 'YOUR_TELEGRAM_ID';
    if (userId.toString() !== OWNER_ID.toString()) {
        bot.sendMessage(chatId, '❌ *Access Denied:* This command is for admins only.', { parse_mode: 'Markdown' });
        return;
    }

    const totalConnections = whatsappManager.getAllConnections().length;
    
    if (totalConnections === 0) {
        bot.sendMessage(chatId, '❌ *No active connections to broadcast to.*', { parse_mode: 'Markdown' });
        return;
    }

    const sent = await bot.sendMessage(chatId, `📢 *Broadcasting to ${totalConnections} connections...*`, { parse_mode: 'Markdown' });
    
    try {
        const results = await whatsappManager.broadcastMessage(message);
        const success = results.filter(r => r.status === 'success').length;
        const failed = results.filter(r => r.status === 'failed').length;

        bot.editMessageText(
            `
╔═══════════════════╗
║  📢 BROADCAST RESULTS  ║
╚═══════════════════╝

✅ *Successful:* ${success}
❌ *Failed:* ${failed}
📊 *Total Sent:* ${totalConnections}

━━━━━━━━━━━━━━━━━━━
💡 *Message broadcast completed*
            `,
            {
                chat_id: chatId,
                message_id: sent.message_id,
                parse_mode: 'Markdown'
            }
        );
    } catch (error) {
        bot.editMessageText(`❌ *Broadcast failed:* ${error.message}`, {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: 'Markdown'
        });
    }
});

// Callback query handlers
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const messageId = query.message.message_id;
    const userId = query.from.id;

    try {
        await bot.answerCallbackQuery(query.id);

        if (data === 'main_menu') {
            const menuText = `
╔═══════════════════╗
║    🏠 MAIN MENU    ║
╚═══════════════════╝

📱 *WhatsApp Pairing Bot*
━━━━━━━━━━━━━━━━━━━

🔹 Connect your WhatsApp
🔹 Manage connections
🔹 Get support

━━━━━━━━━━━━━━━━━━━
💡 Select an option below:
`;
            
            const opts = {
                message_id: messageId,
                chat_id: chatId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📱 Pair WhatsApp", callback_data: "pair_info" }],
                        [{ text: "📋 My Connections", callback_data: "list_my_connections" }],
                        [{ text: "ℹ️ Bot Info", callback_data: "bot_info" }],
                        [{ text: "💬 Support Group", url: "https://t.me/Davexgroupchart" }],
                        [{ text: "📢 Channel", url: "https://t.me/DavexTech" }]
                    ]
                }
            };
            
            bot.editMessageText(menuText, opts);

        } else if (data === 'pair_info') {
            const pairText = `
╔═══════════════════╗
║   📱 HOW TO PAIR   ║
╚═══════════════════╝

*Step-by-step guide:*

1️⃣ Use command: \`/pair <number>\`
2️⃣ Example: \`/pair 2547xxxxxxxx\`
3️⃣ Get your pairing code
4️⃣ Enter code in WhatsApp

━━━━━━━━━━━━━━━━━━━
⚠️ *Important Notes:*
• Use international format (254...)
• No + or 0 prefix needed
• One connection per number

━━━━━━━━━━━━━━━━━━━
`;
            
            bot.editMessageText(pairText, {
                message_id: messageId,
                chat_id: chatId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📱 Start Pairing", callback_data: "start_pairing" }],
                        [{ text: "🔙 Back to Menu", callback_data: "main_menu" }]
                    ]
                }
            });

        } else if (data === 'list_my_connections') {
            const userConnections = connectedUsers[chatId] || [];

            if (userConnections.length === 0) {
                bot.editMessageText(
                    `
╔═══════════════════╗
║  📱 NO CONNECTIONS  ║
╚═══════════════════╝

❌ *You don't have any active connections.*

💡 *Use /pair to connect WhatsApp*
                    `,
                    {
                        message_id: messageId,
                        chat_id: chatId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "📱 Pair WhatsApp", callback_data: "pair_info" }],
                                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                            ]
                        }
                    }
                );
                return;
            }

            let connectionList = `
╔═══════════════════╗
║  📱 MY CONNECTIONS  ║
╚═══════════════════╝

`;

            userConnections.forEach((conn, index) => {
                const status = conn.status === 'online' ? '🟢 Online' : '🔴 Offline';
                const timeAgo = conn.connectedAt ? moment(conn.connectedAt).fromNow() : 'N/A';
                connectionList += `${index + 1}. ${status} \`${conn.phoneNumber}\`\n   📅 ${timeAgo}\n\n`;
            });

            connectionList += `━━━━━━━━━━━━━━━━━━━\n📊 *Total:* ${userConnections.length} connection(s)`;

            const buttons = userConnections.map(conn => [
                { text: `❌ Disconnect ${conn.phoneNumber}`, callback_data: `disconnect_${conn.phoneNumber}` }
            ]);
            buttons.push([{ text: "🔄 Refresh", callback_data: "refresh_connections" }]);
            buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);

            bot.editMessageText(connectionList, {
                message_id: messageId,
                chat_id: chatId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });

        } else if (data.startsWith('disconnect_')) {
            const phoneNumber = data.replace('disconnect_', '');
            const success = whatsappManager.disconnect(phoneNumber);

            if (success) {
                if (connectedUsers[chatId]) {
                    connectedUsers[chatId] = connectedUsers[chatId].filter(u => u.phoneNumber !== phoneNumber);
                    if (connectedUsers[chatId].length === 0) {
                        delete connectedUsers[chatId];
                    }
                    saveConnectedUsers();
                }

                bot.editMessageText(
                    `
╔═══════════════════╗
║  ✅ DISCONNECTED   ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
✅ *Status:* Disconnected successfully

━━━━━━━━━━━━━━━━━━━
💡 *Session removed*
                    `,
                    {
                        message_id: messageId,
                        chat_id: chatId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "📋 View Connections", callback_data: "list_my_connections" }],
                                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                            ]
                        }
                    }
                );
            } else {
                bot.editMessageText(
                    '❌ *Failed to disconnect. Session may not exist.*',
                    {
                        message_id: messageId,
                        chat_id: chatId,
                        parse_mode: 'Markdown'
                    }
                );
            }

        } else if (data === 'verify_membership') {
            const membership = await checkMembership(userId);

            if (membership.bothJoined) {
                bot.editMessageText(
                    '✅ *Membership verified!*\n\nYou can now use `/pair` to connect WhatsApp.',
                    {
                        message_id: messageId,
                        chat_id: chatId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "📱 Pair WhatsApp", callback_data: "pair_info" }],
                                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                            ]
                        }
                    }
                );
            } else {
                bot.editMessageText(
                    '❌ *Please join both channel and group first.*',
                    {
                        message_id: messageId,
                        chat_id: chatId,
                        parse_mode: 'Markdown'
                    }
                );
            }

        } else if (data.startsWith('copy_')) {
            const code = data.replace('copy_', '');
            bot.editMessageText(
                `📋 *Code copied to clipboard!*\n\n🔢 \`${code}\``,
                {
                    message_id: messageId,
                    chat_id: chatId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                        ]
                    }
                }
            );

        } else if (data.startsWith('regenerate_')) {
            const phoneNumber = data.replace('regenerate_', '');
            
            bot.editMessageText(
                `🔄 *Regenerating pairing code for:*\n\`${phoneNumber}\``,
                {
                    message_id: messageId,
                    chat_id: chatId,
                    parse_mode: 'Markdown'
                }
            );

            whatsappManager.disconnect(phoneNumber);

            setTimeout(async () => {
                try {
                    await whatsappManager.requestPairingCode(phoneNumber, chatId);
                } catch (error) {
                    bot.sendMessage(chatId, `❌ *Error regenerating code:* ${error.message}`, { parse_mode: 'Markdown' });
                }
            }, 1000);

        } else if (data === 'refresh_connections') {
            const userConnections = connectedUsers[chatId] || [];

            if (userConnections.length === 0) {
                bot.editMessageText(
                    '📱 *No active connections found.*',
                    {
                        message_id: messageId,
                        chat_id: chatId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "📱 Pair WhatsApp", callback_data: "pair_info" }],
                                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                            ]
                        }
                    }
                );
                return;
            }

            let connectionList = `
╔═══════════════════╗
║  📱 REFRESHED      ║
╚═══════════════════╝

`;

            userConnections.forEach((conn, index) => {
                const status = conn.status === 'online' ? '🟢 Online' : '🔴 Offline';
                const timeAgo = conn.connectedAt ? moment(conn.connectedAt).fromNow() : 'N/A';
                connectionList += `${index + 1}. ${status} \`${conn.phoneNumber}\`\n   📅 ${timeAgo}\n\n`;
            });

            connectionList += `━━━━━━━━━━━━━━━━━━━\n📊 *Total:* ${userConnections.length} connection(s)`;

            const buttons = userConnections.map(conn => [
                { text: `❌ Disconnect ${conn.phoneNumber}`, callback_data: `disconnect_${conn.phoneNumber}` }
            ]);
            buttons.push([{ text: "🔄 Refresh Again", callback_data: "refresh_connections" }]);
            buttons.push([{ text: "🏠 Main Menu", callback_data: "main_menu" }]);

            bot.editMessageText(connectionList, {
                message_id: messageId,
                chat_id: chatId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });
        }

    } catch (error) {
        console.error(chalk.red('Callback query error:', error));
        bot.answerCallbackQuery(query.id, {
            text: "❌ An error occurred",
            show_alert: true
        });
    }
});

// Load connected users on startup
loadConnectedUsers();

// Load existing sessions
async function loadExistingSessions() {
    try {
        const sessions = fs.readdirSync(sessionBasePath);
        for (const session of sessions) {
            if (session.startsWith('session_')) {
                const phoneNumber = session.replace('session_', '');
                console.log(chalk.blue(`Found existing session: ${phoneNumber}`));

                for (const [telegramId, connections] of Object.entries(connectedUsers)) {
                    const existing = connections.find(c => c.phoneNumber === phoneNumber);
                    if (existing) {
                        console.log(chalk.yellow(`Session ${phoneNumber} found for user ${telegramId}, reconnecting...`));

                        try {
                            await whatsappManager.createConnection(phoneNumber, telegramId);
                            console.log(chalk.green(`Reconnected session: ${phoneNumber}`));
                        } catch (error) {
                            console.error(chalk.red(`Failed to reconnect ${phoneNumber}:`, error));
                        }
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error(chalk.red('Error loading existing sessions:', error));
    }
}

// Start the system
console.log(chalk.green.bold(`
╔════════════════════════════╗
║  ✅ TELEGRAM BOT STARTED    ║
╚════════════════════════════╝

📱 Telegram Bot: Active
🔗 WhatsApp Bridge: Ready
⏰ Time: ${moment().format('HH:mm:ss')}
📅 Date: ${moment().format('DD/MM/YYYY')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠 Developer: @Digladoo
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`));

// Load existing sessions after a delay
setTimeout(() => {
    loadExistingSessions();
}, 3000);