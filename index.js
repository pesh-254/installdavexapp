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
    console.error(chalk.red.bold('❌ Telegram bot token is not set. Please set TELEGRAM_BOT_TOKEN environment variable.'));
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

// Load initial data
global.messageBackup = loadStoredMessages();

// --- Connected Users Management ---
let connectedUsers = {};
function loadConnectedUsers() {
    try {
        if (fs.existsSync(connectedUsersFilePath)) {
            const data = fs.readFileSync(connectedUsersFilePath, 'utf-8');
            connectedUsers = JSON.parse(data);
            console.log(chalk.green(`✅ Loaded ${Object.keys(connectedUsers).length} connected users`));
        }
    } catch (error) {
        console.error(chalk.red('❌ Error loading connected users:', error));
    }
}

function saveConnectedUsers() {
    try {
        fs.writeFileSync(connectedUsersFilePath, JSON.stringify(connectedUsers, null, 2));
    } catch (error) {
        console.error(chalk.red('❌ Error saving connected users:', error));
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
        console.error(chalk.red('❌ Error checking membership:', error));
        return { isChannelMember: false, isGroupMember: false, bothJoined: false };
    }
}

// --- WhatsApp Bot Manager Class ---
class WhatsAppBotManager {
    constructor() {
        this.connections = new Map();
        this.activeConnections = new Map();
        this.reconnectionAttempts = new Map();
        this.maxReconnectionAttempts = 5;
    }

    // Load WhatsApp bot dependencies
    async loadWhatsAppDependencies() {
        try {
            // Check if files exist first
            if (!fs.existsSync('./settings.js')) {
                console.log(chalk.yellow('⚠️ settings.js not found, creating default...'));
                fs.writeFileSync('./settings.js', 'module.exports = {};');
            }

            if (!fs.existsSync('./main.js')) {
                console.log(chalk.yellow('⚠️ main.js not found'));
                return false;
            }

            require('./settings');
            const mainModules = require('./main');

            if (mainModules.handleMessages) {
                handleMessages = mainModules.handleMessages;
            } else {
                console.log(chalk.yellow('⚠️ handleMessages not found in main.js'));
                handleMessages = () => console.log('Message handler not available');
            }

            if (mainModules.handleGroupParticipantUpdate) {
                handleGroupParticipantUpdate = mainModules.handleGroupParticipantUpdate;
            } else {
                console.log(chalk.yellow('⚠️ handleGroupParticipantUpdate not found'));
                handleGroupParticipantUpdate = () => {};
            }

            if (mainModules.handleStatus) {
                handleStatus = mainModules.handleStatus;
            } else {
                console.log(chalk.yellow('⚠️ handleStatus not found'));
                handleStatus = () => {};
            }

            // Try to load myfunc
            try {
                if (fs.existsSync('./lib/myfunc.js')) {
                    const myfuncModule = require('./lib/myfunc');
                    smsg = myfuncModule.smsg;
                    console.log(chalk.green('✅ myfunc.js loaded'));
                } else {
                    console.log(chalk.yellow('⚠️ myfunc.js not found'));
                    smsg = {};
                }
            } catch (e) {
                console.log(chalk.yellow(`⚠️ Error loading myfunc: ${e.message}`));
                smsg = {};
            }

            // Try to load store
            try {
                if (fs.existsSync('./lib/lightweight_store.js')) {
                    store = require('./lib/lightweight_store');
                    if (store.readFromFile) store.readFromFile();
                    console.log(chalk.green('✅ lightweight_store.js loaded'));
                } else {
                    console.log(chalk.yellow('⚠️ lightweight_store.js not found'));
                    store = {};
                }
            } catch (e) {
                console.log(chalk.yellow(`⚠️ Error loading store: ${e.message}`));
                store = {};
            }

            settings = require('./settings');

            // Auto-save store periodically
            if (store.writeToFile) {
                setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);
                console.log(chalk.green('✅ Store auto-save enabled'));
            }

            console.log(chalk.green('✨ WhatsApp bot dependencies loaded successfully.'));
            return true;
        } catch (error) {
            console.error(chalk.red(`❌ Failed to load WhatsApp dependencies: ${error.message}`));
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
                version: version,
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
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
            });

            // Bind store if available
            if (store && store.bind) {
                store.bind(conn.ev);
                console.log(chalk.green(`✅ Store bound for ${phoneNumber}`));
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
                    console.error(chalk.red(`❌ Message handler error: ${e.message}`)); 
                }
            });

            // --- CONNECTION UPDATE HANDLER ---
            conn.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (connection === 'open') {
                    // Reset reconnection attempts on successful connection
                    this.reconnectionAttempts.delete(phoneNumber);
                    
                    await saveCreds();
                    console.log(chalk.green(`✅ WhatsApp connected: ${phoneNumber}`));

                    // Update connected users
                    if (!connectedUsers[telegramChatId]) {
                        connectedUsers[telegramChatId] = [];
                    }

                    const existingIndex = connectedUsers[telegramChatId].findIndex(u => u.phoneNumber === phoneNumber);
                    if (existingIndex === -1) {
                        connectedUsers[telegramChatId].push({ 
                            phoneNumber, 
                            connectedAt: new Date().toISOString(),
                            status: 'online',
                            telegramChatId
                        });
                    } else {
                        connectedUsers[telegramChatId][existingIndex].status = 'online';
                        connectedUsers[telegramChatId][existingIndex].lastConnected = new Date().toISOString();
                    }
                    saveConnectedUsers();

                    // Send welcome message after connection
                    await this.sendWelcomeMessage(conn, phoneNumber, telegramChatId);

                } else if (connection === 'close') {
                    console.log(chalk.yellow(`⚠️ WhatsApp disconnected: ${phoneNumber}`));

                    // Update status
                    if (connectedUsers[telegramChatId]) {
                        const userIndex = connectedUsers[telegramChatId].findIndex(u => u.phoneNumber === phoneNumber);
                        if (userIndex !== -1) {
                            connectedUsers[telegramChatId][userIndex].status = 'offline';
                            connectedUsers[telegramChatId][userIndex].lastDisconnected = new Date().toISOString();
                            saveConnectedUsers();
                        }
                    }

                    // Clean up current connection
                    this.connections.delete(phoneNumber);
                    this.activeConnections.delete(phoneNumber);

                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    if (shouldReconnect) {
                        // Increment reconnection attempts
                        const attempts = (this.reconnectionAttempts.get(phoneNumber) || 0) + 1;
                        this.reconnectionAttempts.set(phoneNumber, attempts);
                        
                        if (attempts <= this.maxReconnectionAttempts) {
                            // Exponential backoff: 5, 10, 20, 40, 60 seconds
                            const delayTime = Math.min(60000, 5000 * Math.pow(2, attempts - 1));
                            
                            console.log(chalk.blue(`🔄 Reconnecting ${phoneNumber} in ${delayTime/1000} seconds (attempt ${attempts}/${this.maxReconnectionAttempts})...`));
                            
                            setTimeout(async () => {
                                try {
                                    if (this.connections.has(phoneNumber)) {
                                        console.log(chalk.yellow(`⚠️ ${phoneNumber} already reconnecting, skipping...`));
                                        return;
                                    }
                                    
                                    console.log(chalk.blue(`🔄 Attempting reconnection for ${phoneNumber}...`));
                                    await this.createConnection(phoneNumber, telegramChatId);
                                } catch (error) {
                                    console.error(chalk.red(`❌ Reconnection failed for ${phoneNumber}:`, error));
                                }
                            }, delayTime);
                        } else {
                            console.log(chalk.red(`❌ Max reconnection attempts (${this.maxReconnectionAttempts}) reached for ${phoneNumber}`));
                            this.reconnectionAttempts.delete(phoneNumber);
                            
                            // Notify user via Telegram
                            try {
                                await bot.sendMessage(telegramChatId, `
╔═══════════════════╗
║  ❌ MAX RECONNECTS   ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
⚠️ *Status:* Failed to reconnect after ${this.maxReconnectionAttempts} attempts

━━━━━━━━━━━━━━━━━━━
💡 *Please use /pair again to reconnect*
                                `, { parse_mode: 'Markdown' });
                            } catch (telegramError) {
                                console.error(chalk.red('❌ Could not send Telegram notification:', telegramError));
                            }
                        }
                    } else {
                        // User logged out, clean up session
                        console.log(chalk.yellow(`⚠️ User logged out: ${phoneNumber}`));
                        this.reconnectionAttempts.delete(phoneNumber);
                        await this.disconnect(phoneNumber);
                    }
                } else if (qr) {
                    console.log(chalk.blue(`📱 QR Code generated for ${phoneNumber}`));
                }
            });

            conn.ev.on('creds.update', saveCreds);

            // Handle connection errors
            conn.ev.on('connection.error', (error) => {
                console.error(chalk.red(`❌ Connection error for ${phoneNumber}:`, error));
            });

            // Store connection
            this.connections.set(phoneNumber, { conn, telegramChatId, phoneNumber });
            this.activeConnections.set(phoneNumber, conn);

            console.log(chalk.green(`✅ Connection created for ${phoneNumber}`));
            return conn;

        } catch (error) {
            console.error(chalk.red(`❌ Error creating connection for ${phoneNumber}:`, error));
            
            // Clean up on error
            this.connections.delete(phoneNumber);
            this.activeConnections.delete(phoneNumber);
            
            throw error;
        }
    }

    // --- WELCOME MESSAGE FUNCTION ---
    async sendWelcomeMessage(conn, phoneNumber, telegramChatId) {
        try {
            // Wait for connection to stabilize
            await delay(5000);

            // Check if connection is ready
            if (!conn.user || !conn.user.id) {
                console.log(chalk.yellow(`⚠️ Connection not ready for ${phoneNumber}, retrying...`));
                await delay(5000);
                if (!conn.user || !conn.user.id) {
                    console.log(chalk.red(`❌ Connection failed for ${phoneNumber}`));
                    return;
                }
            }

            // Platform detection
            const detectPlatform = () => {
                if (process.env.DYNO) return "☁️ Heroku";
                if (process.env.RENDER) return "⚡ Render";
                if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "📱 Termux";
                if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return "🌀 CypherX Platform";
                if (process.env.P_SERVER_UUID) return "🖥️ Panel";
                if (process.env.LXC) return "📦 Linux Container (LXC)";

                switch (os.platform()) {
                    case "win32": return "🪟 Windows";
                    case "darwin": return "🍎 macOS";
                    case "linux": return "🐧 Linux";
                    default: return "❓ Unknown";
                }
            };

            const hostName = detectPlatform();

            let isPublic = true;
            try {
                if (fs.existsSync('./data/messageCount.json')) {
                    const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                    isPublic = data.isPublic !== false;
                }
            } catch (e) {
                console.log(chalk.yellow('⚠️ Could not load messageCount.json'));
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
                console.log(chalk.yellow('⚠️ Could not load setprefix module'));
            }

            const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
            const time = new Date().toLocaleString();

            // Send WhatsApp welcome message
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
                console.log(chalk.green(`✅ WhatsApp welcome sent to ${phoneNumber}`));
            } catch (error) {
                console.error(chalk.red(`❌ Could not send WhatsApp welcome: ${error.message}`));
            }

            // AUTOJOIN 1: Follow newsletter/channel
            await delay(2000);
            try {
                await conn.newsletterFollow('120363400480173280@newsletter');
                console.log(chalk.green('[DAVE-X] ✅ Newsletter followed'));
            } catch (err) {
                console.log(chalk.yellow(`[DAVE-X] ⚠️ Newsletter failed: ${err.message}`));
            }

            // AUTOJOIN 2: Join WhatsApp group
            await delay(2000);
            try {
                await conn.groupAcceptInvite('KiNnMy4plNd4gSIFMlf4dg');
                console.log(chalk.green('[DAVE-MD] ✅ Group invite accepted'));
            } catch (err) {
                console.log(chalk.yellow(`[DAVE-MD] ⚠️ Group invite failed: ${err.message}`));
            }

            // Send Telegram success message
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

✅ *Auto-joined to:*
• WhatsApp Channel
• WhatsApp Group

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
            console.log(chalk.green(`✅ Telegram notification sent for ${phoneNumber}`));

        } catch (e) {
            console.error(chalk.red(`❌ Error in welcome message: ${e.message}`));
        }
    }

    // Request pairing code
    async requestPairingCode(phoneNumber, telegramChatId) {
        try {
            console.log(chalk.blue(`🔄 Creating connection for ${phoneNumber}...`));
            
            // Reset reconnection attempts for this number
            this.reconnectionAttempts.delete(phoneNumber);
            
            const conn = await this.createConnection(phoneNumber, telegramChatId);

            setTimeout(async () => {
                try {
                    console.log(chalk.blue(`🔑 Requesting pairing code for ${phoneNumber}...`));
                    let code = await conn.requestPairingCode(phoneNumber);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;

                    pairingCodes.set(code, { 
                        phoneNumber, 
                        telegramChatId,
                        requestedAt: new Date().toISOString() 
                    });

                    console.log(chalk.green(`✅ Pairing code generated for ${phoneNumber}: ${code}`));

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
                    console.error(chalk.red(`❌ Error getting pairing code:`, error));
                    bot.sendMessage(telegramChatId, '❌ Failed to generate pairing code. Please try again.');
                }
            }, 3000);

        } catch (error) {
            console.error(chalk.red(`❌ Error in pairing process:`, error));
            bot.sendMessage(telegramChatId, `❌ Error: ${error.message}`);
        }
    }

    // Disconnect WhatsApp
    async disconnect(phoneNumber) {
        const connection = this.connections.get(phoneNumber);
        
        if (connection) {
            try {
                // Remove from reconnection attempts
                this.reconnectionAttempts.delete(phoneNumber);
                
                // Remove from connection maps
                this.connections.delete(phoneNumber);
                this.activeConnections.delete(phoneNumber);

                if (connection.conn) {
                    try {
                        // Try to logout gracefully
                        if (connection.conn.logout && typeof connection.conn.logout === 'function') {
                            await connection.conn.logout().catch(() => {});
                        }
                        
                        // Close WebSocket if it exists
                        if (connection.conn.ws && connection.conn.ws.readyState !== 3) { // 3 = CLOSED
                            connection.conn.ws.close();
                        }
                    } catch (logoutError) {
                        console.log(chalk.yellow(`⚠️ Could not logout gracefully for ${phoneNumber}: ${logoutError.message}`));
                    }
                }

                // Remove session files
                const sessionPath = path.join(sessionBasePath, `session_${phoneNumber}`);
                if (fs.existsSync(sessionPath)) {
                    try {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                        console.log(chalk.green(`🗑️ Session files deleted for ${phoneNumber}`));
                    } catch (deleteError) {
                        console.error(chalk.red(`❌ Error deleting session files for ${phoneNumber}:`, deleteError));
                    }
                }

                // Update connected users
                const telegramChatId = connection.telegramChatId;
                if (connectedUsers[telegramChatId]) {
                    connectedUsers[telegramChatId] = connectedUsers[telegramChatId].filter(u => u.phoneNumber !== phoneNumber);
                    if (connectedUsers[telegramChatId].length === 0) {
                        delete connectedUsers[telegramChatId];
                    }
                    saveConnectedUsers();
                }

                console.log(chalk.green(`✅ Disconnected ${phoneNumber} successfully`));
                return true;
            } catch (error) {
                console.error(chalk.red(`❌ Error disconnecting ${phoneNumber}:`, error));
                return false;
            }
        }
        return false;
    }

    getAllConnections() {
        return Array.from(this.connections.values());
    }
    
    getConnection(phoneNumber) {
        return this.connections.get(phoneNumber);
    }
}

// Initialize manager
const whatsappManager = new WhatsAppBotManager();

// Load WhatsApp dependencies
whatsappManager.loadWhatsAppDependencies().then(success => {
    if (success) {
        console.log(chalk.green('✅ WhatsApp bot ready'));
    } else {
        console.log(chalk.yellow('⚠️ WhatsApp dependencies not fully loaded'));
    }
});

// ================ TELEGRAM BOT COMMANDS ================

// Console logging for commands
bot.on('text', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const username = msg.from.username;
    const command = text.split(' ')[0].toLowerCase();
    if (command.startsWith('/')) {
        console.log(chalk.green(`✅ Command: ${command} | User: @${username || 'no-username'} | ID: ${chatId}`));
    }
});

// Track Telegram users
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

// /pair command - FIXED: Shows instructions if no number provided
bot.onText(/\/pair$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const instructions = `
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
✅ *Ready to pair?*

Use: \`/pair 2547xxxxxxxx\`
`;

    bot.sendMessage(chatId, instructions, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📱 Start Pairing", callback_data: "start_pairing" }],
                [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
            ]
        }
    });
});

// /pair command with number
bot.onText(/\/pair (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const phoneNumber = match[1].trim();

    // Check if user has reached rate limit
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
*Please wait 3-5 seconds...*
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

    const success = await whatsappManager.disconnect(phoneNumber);

    if (success) {
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

        } else if (data === 'start_pairing') {
            bot.editMessageText(
                '💡 *To start pairing, use the command:*\n\n`/pair 2547xxxxxxxx`\n\n*Replace with your phone number*',
                {
                    message_id: messageId,
                    chat_id: chatId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔙 Back", callback_data: "pair_info" }],
                            [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                        ]
                    }
                }
            );

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
            const success = await whatsappManager.disconnect(phoneNumber);

            if (success) {
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
                bot.answerCallbackQuery(query.id, {
                    text: "❌ Failed to disconnect. Session may not exist.",
                    show_alert: true
                });
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
                bot.answerCallbackQuery(query.id, {
                    text: "❌ Please join both channel and group first!",
                    show_alert: true
                });
            }

        } else if (data.startsWith('copy_')) {
            const code = data.replace('copy_', '');
            bot.answerCallbackQuery(query.id, { 
                text: `📋 Code ${code} copied to clipboard!`, 
                show_alert: true 
            });

        } else if (data.startsWith('regenerate_')) {
            const phoneNumber = data.replace('regenerate_', '');
            bot.editMessageText(
                `🔄 *Regenerating pairing code for:*\n\`${phoneNumber}\`\n\n⏳ *Please wait...*`,
                {
                    message_id: messageId,
                    chat_id: chatId,
                    parse_mode: 'Markdown'
                }
            );

            await whatsappManager.disconnect(phoneNumber);

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
        console.error(chalk.red('❌ Callback query error:', error));
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
                console.log(chalk.blue(`🔄 Found existing session: ${phoneNumber}`));

                for (const [telegramId, connections] of Object.entries(connectedUsers)) {
                    const existing = connections.find(c => c.phoneNumber === phoneNumber);
                    if (existing) {
                        console.log(chalk.yellow(`⚠️ Session ${phoneNumber} found for user ${telegramId}, reconnecting...`));

                        try {
                            await whatsappManager.createConnection(phoneNumber, telegramId);
                            console.log(chalk.green(`✅ Reconnected session: ${phoneNumber}`));
                        } catch (error) {
                            console.error(chalk.red(`❌ Failed to reconnect ${phoneNumber}:`, error));
                        }
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error(chalk.red('❌ Error loading existing sessions:', error));
    }
}

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
    console.error(chalk.red.bold('❌ Uncaught Exception:'), error);
    console.log(chalk.yellow('⚠️ Bot will continue running...'));
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red.bold('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
    console.log(chalk.yellow('⚠️ Bot will continue running...'));
});

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
}, 5000);