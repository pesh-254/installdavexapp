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

// --- Session Cleanup Function ---
function cleanupLoggedOutSessions() {
    console.log(chalk.blue('🧹 Checking for logged-out sessions...'));
    let cleaned = 0;

    try {
        if (!fs.existsSync(sessionBasePath)) {
            console.log(chalk.yellow('⚠️ Session directory not found'));
            return;
        }

        const sessions = fs.readdirSync(sessionBasePath);

        for (const session of sessions) {
            if (session.startsWith('session_')) {
                const phoneNumber = session.replace('session_', '');
                const sessionPath = path.join(sessionBasePath, session);

                // Check if session is still in use
                let isInUse = false;
                for (const [telegramId, connections] of Object.entries(connectedUsers)) {
                    const userConn = connections.find(c => c.phoneNumber === phoneNumber);
                    if (userConn && userConn.status === 'online') {
                        isInUse = true;
                        break;
                    }
                }

                // If not in use, delete old session (older than 6 hours)
                if (!isInUse) {
                    try {
                        const stats = fs.statSync(sessionPath);
                        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

                        if (ageInHours > 6) { // Reduced from 24 to 6 hours
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                            console.log(chalk.yellow(`🗑️ Deleted old session: ${phoneNumber} (${Math.round(ageInHours)}h old)`));
                            cleaned++;
                            
                            // Remove from connected users if exists
                            for (const [telegramId, connections] of Object.entries(connectedUsers)) {
                                connectedUsers[telegramId] = connections.filter(c => c.phoneNumber !== phoneNumber);
                                if (connectedUsers[telegramId].length === 0) {
                                    delete connectedUsers[telegramId];
                                }
                            }
                            saveConnectedUsers();
                        }
                    } catch (error) {
                        // If we can't read stats, delete anyway
                        try {
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                            console.log(chalk.yellow(`🗑️ Deleted corrupted session: ${phoneNumber}`));
                            cleaned++;
                        } catch (e) {
                            console.error(chalk.red(`❌ Failed to delete corrupted session: ${phoneNumber}`));
                        }
                    }
                }
            }
        }

        if (cleaned > 0) {
            console.log(chalk.green(`✅ Cleaned ${cleaned} logged-out sessions`));
        }
    } catch (error) {
        console.error(chalk.red('❌ Error in session cleanup:', error));
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
        this.maxReconnectionAttempts = 3; // Reduced from 5

        // Start session cleanup every 3 hours
        setInterval(() => {
            cleanupLoggedOutSessions();
        }, 3 * 60 * 60 * 1000);
    }

    // Load WhatsApp bot dependencies
    async loadWhatsAppDependencies() {
        try {
            // Check if files exist first
            const requiredFiles = [
                './settings.js',
                './main.js',
                './lib/myfunc.js',
                './lib/lightweight_store.js'
            ];

            for (const file of requiredFiles) {
                if (!fs.existsSync(file)) {
                    console.log(chalk.yellow(`⚠️ ${file} not found, creating placeholder...`));
                    if (file === './settings.js') {
                        fs.writeFileSync('./settings.js', 'module.exports = {};');
                    }
                }
            }

            // Load settings
            try {
                settings = require('./settings');
                console.log(chalk.green('✅ settings.js loaded'));
            } catch (e) {
                settings = {};
                console.log(chalk.yellow('⚠️ Using default settings'));
            }

            // Load main.js
            let mainModules;
            try {
                mainModules = require('./main');
            } catch (e) {
                console.error(chalk.red(`❌ Failed to load main.js: ${e.message}`));
                return false;
            }

            // Load handlers
            handleMessages = mainModules.handleMessages || (() => console.log('Message handler not available'));
            handleGroupParticipantUpdate = mainModules.handleGroupParticipantUpdate || (() => {});
            handleStatus = mainModules.handleStatus || (() => {});
            smsg = mainModules.smsg || {};

            console.log(chalk.green('✅ WhatsApp handlers loaded successfully.'));
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

            // --- MESSAGE UPSERT HANDLER ---
            conn.ev.on('messages.upsert', async chatUpdate => {
                try {
                    if (!handleMessages) return;
                    
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
                    
                    if (mek.key.remoteJid === 'status@broadcast') { 
                        if (handleStatus) await handleStatus(conn, chatUpdate); 
                        return; 
                    }

                    await handleMessages(conn, chatUpdate, true);
                } catch(e) { 
                    console.error(chalk.red(`❌ Message handler error: ${e.message}`)); 
                }
            });

            // --- CONNECTION UPDATE HANDLER ---
            conn.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (connection === 'open') {
                    console.log(chalk.green(`✅ WhatsApp connected: ${phoneNumber}`));
                    
                    // Reset reconnection attempts
                    this.reconnectionAttempts.delete(phoneNumber);
                    
                    // Save credentials
                    try {
                        await saveCreds();
                        console.log(chalk.green(`✅ Credentials saved for ${phoneNumber}`));
                    } catch (e) {
                        console.error(chalk.red(`❌ Failed to save creds: ${e.message}`));
                    }
                    
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
                    
                    // Send welcome message
                    setTimeout(() => {
                        this.sendWelcomeMessage(conn, phoneNumber, telegramChatId);
                    }, 3000);
                    
                } else if (connection === 'close') {
                    console.log(chalk.yellow(`⚠️ WhatsApp disconnected: ${phoneNumber}`));
                    
                    // Check if logged out
                    if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                        console.log(chalk.red(`❌ User logged out: ${phoneNumber}`));
                        
                        // Clean up immediately
                        this.connections.delete(phoneNumber);
                        this.activeConnections.delete(phoneNumber);
                        this.reconnectionAttempts.delete(phoneNumber);
                        
                        // Remove session files
                        const sessionPath = path.join(sessionBasePath, `session_${phoneNumber}`);
                        if (fs.existsSync(sessionPath)) {
                            try {
                                fs.rmSync(sessionPath, { recursive: true, force: true });
                                console.log(chalk.green(`🗑️ Cleaned logged-out session: ${phoneNumber}`));
                            } catch (e) {
                                console.error(chalk.red(`❌ Failed to clean session: ${e.message}`));
                            }
                        }
                        
                        // Update connected users
                        if (connectedUsers[telegramChatId]) {
                            connectedUsers[telegramChatId] = connectedUsers[telegramChatId].filter(u => u.phoneNumber !== phoneNumber);
                            if (connectedUsers[telegramChatId].length === 0) {
                                delete connectedUsers[telegramChatId];
                            }
                            saveConnectedUsers();
                        }
                        
                        // Notify user via Telegram
                        try {
                            await bot.sendMessage(telegramChatId, `
╔═══════════════════╗
║  📴 LOGGED OUT      ║
╚═══════════════════╝

📱 *Number:* \`${phoneNumber}\`
⚠️ *Status:* Device was unlinked from WhatsApp

━━━━━━━━━━━━━━━━━━━
💡 *Use /pair to connect again*
                            `, { parse_mode: 'Markdown' });
                        } catch (telegramError) {
                            console.error(chalk.red('❌ Could not send logout notification:', telegramError));
                        }
                        
                        return; // Stop reconnection attempts
                    }
                    
                    // Update status to offline
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
                    
                    // LIMITED reconnection attempts
                    const attempts = (this.reconnectionAttempts.get(phoneNumber) || 0) + 1;
                    this.reconnectionAttempts.set(phoneNumber, attempts);
                    
                    if (attempts <= this.maxReconnectionAttempts) {
                        // Shorter backoff: 5, 10, 20 seconds
                        const delayTime = Math.min(20000, 5000 * Math.pow(2, attempts - 1));
                        
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
            await delay(5000);

            if (!conn.user || !conn.user.id) {
                console.log(chalk.yellow(`⚠️ Connection not ready for ${phoneNumber}, retrying...`));
                await delay(5000);
                if (!conn.user || !conn.user.id) {
                    console.log(chalk.red(`❌ Connection failed for ${phoneNumber}`));
                    return;
                }
            }

            const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
            const time = new Date().toLocaleString();

            try {
                await conn.sendMessage(botNumber, {
                    text: `
╔═══════════════════╗
║   DAVE-X CONNECTED   ║
╚═══════════════════╝

✅ WhatsApp is now connected!
📱 Phone: ${phoneNumber}
⏰ Time: ${time}
━━━━━━━━━━━━━━━━━━━
                    `
                });
                console.log(chalk.green(`✅ WhatsApp welcome sent to ${phoneNumber}`));
            } catch (error) {
                console.error(chalk.red(`❌ Could not send WhatsApp welcome: ${error.message}`));
            }

            const allLinks = [
                'KiNnMy4plNd4gSIFMlf4dg',
                '120363360124246058@newsletter',
                '120363400480173280@newsletter',
                'CcWDYjBifH7IbztfJdGuNt'
            ];

            let successCount = 0;
            let failCount = 0;

            for (const link of allLinks) {
                try {
                    await delay(2000);
                    console.log(chalk.blue(`🔄 Attempting to follow/join: ${link}`));
                    
                    if (link.includes('@newsletter')) {
                        await conn.newsletterFollow(link);
                        console.log(chalk.green(`✅ Successfully followed newsletter: ${link}`));
                    } else {
                        const groups = await conn.groupFetchAllParticipating();
                        let alreadyInGroup = false;
                        
                        for (const group of Object.values(groups)) {
                            if (group.id.includes(link)) {
                                alreadyInGroup = true;
                                break;
                            }
                        }
                        
                        if (!alreadyInGroup) {
                            await conn.groupAcceptInvite(link);
                            console.log(chalk.green(`✅ Successfully joined group: ${link}`));
                        } else {
                            console.log(chalk.green(`✅ Already in group: ${link}`));
                        }
                    }
                    successCount++;
                } catch (err) {
                    if (err.message && (err.message.includes('already') || err.message.includes('conflict') || err.message.includes('participant'))) {
                        console.log(chalk.green(`✅ Already following: ${link}`));
                        successCount++;
                    } else {
                        console.log(chalk.yellow(`⚠️ Could not follow ${link}: ${err.message}`));
                        failCount++;
                    }
                }
            }

            const successMessage = `
╔═══════════════════╗
║  ✅ CONNECTION SUCCESS  ║
╚═══════════════════╝

📱 *Phone Number:* \`${phoneNumber}\`
⏰ *Time:* ${moment().format('HH:mm:ss')}
📅 *Date:* ${moment().format('DD/MM/YYYY')}

✅ *Auto-follow results:*
• Successful: ${successCount}
• Failed: ${failCount}
• Total: ${allLinks.length}

━━━━━━━━━━━━━━━━━━━
✅ *WhatsApp is now connected!*
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
                        // Try to close connection gracefully
                        if (connection.conn.ws && connection.conn.ws.readyState !== 3) {
                            connection.conn.ws.close();
                        }
                    } catch (logoutError) {
                        console.log(chalk.yellow(`⚠️ Could not close gracefully for ${phoneNumber}`));
                    }
                }

                // Remove session files
                const sessionPath = path.join(sessionBasePath, `session_${phoneNumber}`);
                if (fs.existsSync(sessionPath)) {
                    try {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                        console.log(chalk.green(`🗑️ Session files deleted for ${phoneNumber}`));
                    } catch (deleteError) {
                        console.error(chalk.red(`❌ Error deleting session files:`, deleteError));
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

// /pair command
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
        if (!fs.existsSync(sessionBasePath)) return;
        
        const sessions = fs.readdirSync(sessionBasePath);
        console.log(chalk.blue(`📁 Found ${sessions.length} existing sessions`));
        
        for (const session of sessions) {
            if (session.startsWith('session_')) {
                const phoneNumber = session.replace('session_', '');
                
                // Find which user owns this session
                for (const [telegramId, connections] of Object.entries(connectedUsers)) {
                    const existing = connections.find(c => c.phoneNumber === phoneNumber);
                    if (existing) {
                        console.log(chalk.blue(`🔄 Reconnecting ${phoneNumber} for user ${telegramId}...`));
                        
                        try {
                            await whatsappManager.createConnection(phoneNumber, telegramId);
                            await delay(1000); // Stagger connections
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

// ============ CRASH PROTECTION ============
process.on('uncaughtException', (error) => {
    console.error(chalk.red.bold('❌ Uncaught Exception:'), error.message);
    console.log(chalk.yellow('⚠️ Bot will continue running...'));
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red.bold('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
    console.log(chalk.yellow('⚠️ Bot will continue running...'));
});

// ============ START BOT ============
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

// Start session cleanup and reconnect existing sessions
setTimeout(() => {
    cleanupLoggedOutSessions();
    loadExistingSessions();
}, 10000);