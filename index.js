// --- VENOM-X WhatsApp Bot ---
// Complete with DAVE-AI session format, pairing code, and auto-joins

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  delay 
} from '@whiskeysockets/baileys';

import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import axios from 'axios';
import archiver from 'archiver';
import { loadSettings, saveSettings, updateSetting, getCurrentSettings } from './lib/persistentData.js';
import { handleLinkDetection } from './daveplugins/antilink.js';
import isAdmin from './lib/isAdmin.js';
import { buttonResponses } from './lib/menuButtons.js';
import { storeMessage, handleMessageRevocation } from './daveplugins/self/antidelete.js';
import { readState as readAnticallState } from './daveplugins/self/anticall.js';
import { checkAutoGreetings } from './daveplugins/self/autogreet.js';
import chalk from 'chalk';
import PhoneNumber from 'awesome-phonenumber';
import readline from 'readline';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 🌟 VENOM-X Logging Function ---
function log(message, color = 'white', isError = false) {
  const prefix = chalk.green.bold('[ VENOM-X ]');
  const logFunc = isError ? console.error : console.log;
  const coloredMessage = chalk[color](message);

  if (message.includes('\n') || message.includes('════')) {
    logFunc(prefix, coloredMessage);
  } else {
    logFunc(`${prefix} ${coloredMessage}`);
  }
}

// --- GLOBAL FLAGS ---
global.isBotConnected = false;
global.errorRetryCount = 0;
global.botname = "VENOM-X"
global.themeemoji = "⚡"

// --- STARTUP GUARD ---
const TEST_MODE = process.env.TEST_MODE_ONLY === 'true';
if (TEST_MODE) {
  log('🛑 TEST MODE ACTIVATED - Bot will load commands but NOT connect to WhatsApp', 'yellow');
  console.log('='.repeat(60));
}

// --- IMPORT CONFIG ---
import config from './config.js';
const COMMAND_PREFIX = process.env.BOT_PREFIX || config.prefix;

global.config = {
  botName: config.botName || "VENOM-X",
  prefix: COMMAND_PREFIX,
  ownerNumber: config.ownerNumber,
  ownerName: config.ownerName || "VENOM-X Owner"
};
global.COMMAND_PREFIX = COMMAND_PREFIX;

// --- PATHS ---
const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');
const loginFile = path.join(sessionDir, 'login.json');
const envPath = path.join(process.cwd(), '.env');
const MODS_FILE = path.join(__dirname, 'data', 'moderators.json');
const BANNED_FILE = path.join(__dirname, 'data', 'banned.json');
const WELCOME_CONFIG_FILE = path.join(__dirname, 'data', 'welcomeConfig.json');
const ANTIDELETE_MESSAGES_FILE = path.join(__dirname, 'data', 'antidelete_messages.json');
const SESSION_ERROR_FILE = path.join(__dirname, 'sessionErrorCount.json');

// --- GLOBALS ---
let botActive = true;
const persistentSettings = loadSettings();
let botMode = persistentSettings.botMode || 'public';
global.botMode = botMode;

// Helper function to parse boolean environment variables
const parseBoolEnv = (key, defaultValue) => {
  const value = process.env[key];
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
};

// Initialize automation globals
global.autoViewMessage = parseBoolEnv('AUTO_VIEW_MESSAGE', persistentSettings.autoViewMessage || false);
global.autoViewStatus = parseBoolEnv('AUTO_VIEW_STATUS', persistentSettings.autoViewStatus || false);
global.autoReactStatus = parseBoolEnv('AUTO_REACT_STATUS', persistentSettings.autoReactStatus || false);
global.autoReact = parseBoolEnv('AUTO_REACT', persistentSettings.autoReact || false);
global.autoStatusEmoji = process.env.AUTO_STATUS_EMOJI || persistentSettings.autoStatusEmoji || '❤️';
global.autoTyping = parseBoolEnv('AUTO_TYPING', persistentSettings.autoTyping || false);
global.autoRecording = parseBoolEnv('AUTO_RECORDING', persistentSettings.autoRecording || false);

// Initialize anti-detection globals
global.antiLinkWarn = persistentSettings.antiLinkWarn || {};
global.antiLinkKick = persistentSettings.antiLinkKick || {};
global.antiBadWord = persistentSettings.antiBadWord || {};

let processedMessages = new Set();
const messageCount = {};
const TIME_LIMIT = 1 * 1000;
const MESSAGE_LIMIT = 2;

// --- NEW: Error Counter Helpers ---
function loadErrorCount() {
  try {
    if (fs.existsSync(SESSION_ERROR_FILE)) {
      const data = fs.readFileSync(SESSION_ERROR_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Error loading session error count: ${error.message}`, 'red', true);
  }
  return { count: 0, last_error_timestamp: 0 };
}

function saveErrorCount(data) {
  try {
    fs.writeFileSync(SESSION_ERROR_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    log(`Error saving session error count: ${error.message}`, 'red', true);
  }
}

function deleteErrorCountFile() {
  try {
    if (fs.existsSync(SESSION_ERROR_FILE)) {
      fs.unlinkSync(SESSION_ERROR_FILE);
      log('✅ Deleted sessionErrorCount.json.', 'red');
    }
  } catch (e) {
    log(`Failed to delete sessionErrorCount.json: ${e.message}`, 'red', true);
  }
}

// --- ♻️ CLEANUP FUNCTIONS ---
function clearSessionFiles() {
  try {
    log('🗑️ Clearing session folder...', 'blue');
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    if (fs.existsSync(loginFile)) fs.unlinkSync(loginFile);
    deleteErrorCountFile();
    global.errorRetryCount = 0;
    log('Session files cleaned successfully.', 'green');
  } catch (e) {
    log(`Failed to clear session files: ${e.message}`, 'red', true);
  }
}

// --- NEW: Session Format Check ---
async function checkAndHandleSessionFormat() {
  const sessionId = process.env.SESSION_ID;

  if (sessionId && sessionId.trim() !== '') {
    if (!sessionId.trim().startsWith('DAVE-AI')) {
      log(chalk.white.bgRed('[ERROR]: Invalid SESSION_ID in .env'), 'white');
      log(chalk.white.bgRed('[SESSION ID] MUST start with "DAVE-AI".'), 'white');
      log(chalk.white.bgRed('Cleaning .env and creating new one...'), 'white');

      try {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/^SESSION_ID=.*$/m, 'SESSION_ID=');
        fs.writeFileSync(envPath, envContent);
        log('Cleaned SESSION_ID entry in .env file.', 'green');
        log('Please add a proper session ID and restart the bot.', 'yellow');
      } catch (e) {
        log(`Failed to modify .env file. Please check permissions: ${e.message}`, 'red', true);
      }

      log('Bot will wait 30 seconds then restart', 'blue');
      await delay(20000);
      process.exit(1);
    }
  }
}

// --- 🌟 NEW: Enhanced Session Management ---
async function saveLoginMethod(method) {
  await fs.promises.mkdir(sessionDir, { recursive: true });
  await fs.promises.writeFile(loginFile, JSON.stringify({ method }, null, 2));
}

async function getLastLoginMethod() {
  if (fs.existsSync(loginFile)) {
    const data = JSON.parse(fs.readFileSync(loginFile, 'utf-8'));
    return data.method;
  }
  return null;
}

function sessionExists() {
  return fs.existsSync(credsPath);
}

async function checkEnvSession() {
  const envSessionID = process.env.SESSION_ID;
  if (envSessionID && envSessionID.includes("DAVE-AI:~")) {
    global.SESSION_ID = envSessionID.trim();
    return true;
  }
  return false;
}

async function downloadSessionData() {
  try {
    await fs.promises.mkdir(sessionDir, { recursive: true });
    if (!fs.existsSync(credsPath) && global.SESSION_ID) {
      const base64Data = global.SESSION_ID.includes("DAVE-AI:~") 
        ? global.SESSION_ID.split("DAVE-AI:~")[1] 
        : global.SESSION_ID;
      const sessionData = Buffer.from(base64Data, 'base64');
      await fs.promises.writeFile(credsPath, sessionData);
      log(`Session successfully saved.`, 'green');
    }
  } catch (err) { 
    log(`Error downloading session data: ${err.message}`, 'red', true); 
  }
}

// --- NEW: Pairing Code Function ---
async function requestPairingCode(socket) {
  try {
    log("Waiting 3 seconds for socket stabilization before requesting pairing code...", 'yellow');
    await delay(3000);

    let code = await socket.requestPairingCode(global.phoneNumber);
    code = code?.match(/.{1,4}/g)?.join("-") || code;
    log(chalk.bgGreen.black(`\nYour Pairing Code: ${code}\n`), 'white');
    log(`
Please enter this code in WhatsApp app:
1. Open WhatsApp
2. Go to Settings => Linked Devices
3. Tap "Link a Device"
4. Enter the code shown above
    `, 'blue');
    return true;
  } catch (err) {
    log(`Failed to get pairing code: ${err.message}`, 'red', true);
    return false;
  }
}

// --- NEW: Get Login Method with Interactive Prompts ---
async function getLoginMethod() {
  const lastMethod = await getLastLoginMethod();
  if (lastMethod && sessionExists()) {
    log(`Last login method detected: ${lastMethod}. Using it automatically.`, 'yellow');
    return lastMethod;
  }

  if (!sessionExists() && fs.existsSync(loginFile)) {
    log(`Session files missing. Removing old login preference for clean re-login.`, 'yellow');
    fs.unlinkSync(loginFile);
  }

  // Interactive prompt
  if (!process.stdin.isTTY) {
    log("❌ No Session ID found in environment variables.", 'red');
    process.exit(1);
  }

  log("Choose login method:", 'yellow');
  log("1) Enter WhatsApp Number (Pairing Code)", 'blue');
  log("2) Paste Session ID", 'blue');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (text) => new Promise(resolve => rl.question(text, resolve));

  let choice = await question("Enter option number (1 or 2): ");
  choice = choice.trim();

  if (choice === '1') {
    let phone = await question(chalk.bgBlack(chalk.greenBright(`Enter your WhatsApp number (e.g., 254104260236): `)));
    phone = phone.replace(/[^0-9]/g, '');
    const pn = new PhoneNumber(`+${phone}`);
    if (!pn.isValid()) { 
      log('Invalid phone number.', 'red'); 
      rl.close();
      return getLoginMethod(); 
    }
    global.phoneNumber = phone;
    await saveLoginMethod('number');
    rl.close();
    return 'number';
  } else if (choice === '2') {
    let sessionId = await question(chalk.bgBlack(chalk.greenBright(`Paste your Session ID here: `)));
    sessionId = sessionId.trim();
    if (!sessionId.includes("DAVE-AI:~")) {
      log("Invalid Session ID format! Must contain 'DAVE-AI:~'.", 'red');
      rl.close();
      process.exit(1);
    }
    global.SESSION_ID = sessionId;
    await saveLoginMethod('session');
    rl.close();
    return 'session';
  } else {
    log("Invalid option! Please choose 1 or 2.", 'red');
    rl.close();
    return getLoginMethod();
  }
}

// --- 🌟 NEW: Fake Contact Generator ---
function createFakeContact(message) {
  return {
    key: {
      participants: "0@s.whatsapp.net",
      remoteJid: "0@s.whatsapp.net",
      fromMe: false
    },
    message: {
      contactMessage: {
        displayName: "VENOM-X",
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:VENOM-X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
      }
    },
    participant: "0@s.whatsapp.net"
  };
}

// --- 🌟 NEW: Welcome Message with Auto-joins ---
async function sendWelcomeMessage(sock) {
  if (global.isBotConnected) return;
  
  await delay(10000); // Wait 10 seconds for stabilization

  const detectPlatform = () => {
    if (process.env.DYNO) return "☁️ Heroku";
    if (process.env.RENDER) return "⚡ Render";
    if (process.env.PREFIX && process.env.PREFIX.includes("termux")) return "📱 Termux";
    if (process.env.PORTS && process.env.CYPHERX_HOST_ID) return "🌀 CypherX Platform";
    if (process.env.P_SERVER_UUID) return "🖥️ Panel";
    if (process.env.LXC) return "📦 Linux Container (LXC)";
    
    switch (process.platform) {
      case "win32": return "🪟 Windows";
      case "darwin": return "🍎 macOS";
      case "linux": return "🐧 Linux";
      default: return "❓ Unknown";
    }
  };

  const hostName = detectPlatform();

  try {
    global.isBotConnected = true;
    const botNumber = sock.user?.id || config.ownerNumber;
    const botJid = botNumber.includes('@') ? botNumber : `${botNumber}@s.whatsapp.net`;
    
    const fake = createFakeContact({
      key: { 
        participant: botJid,
        remoteJid: botJid
      }
    });

    const time = new Date().toLocaleString();
    const welcomeMessage = `
⚡ *VENOM-X CONNECTED!*

┏━━━━━✧ CONNECTION STATUS ✧
┃✧ Prefix: [${COMMAND_PREFIX}]
┃✧ Mode: ${botMode}
┃✧ Platform: ${hostName}
┃✧ Bot: ${global.config.botName}
┃✧ Owner: ${global.config.ownerName}
┃✧ Status: Active
┃✧ Time: ${time}
┃✧ Version: 2.0
┗━━━━━━━━━━━━━━━━━━━━━

📋 *HOW TO USE:*
Type ${COMMAND_PREFIX}menu to see all commands

*Bot is now ready to serve!*

© ${global.config.ownerName}`;

    try {
      await sock.sendMessage(botJid, { text: welcomeMessage }, { quoted: fake });
      log('Startup message sent.', 'green');
    } catch (error) {
      log('Could not send startup message:', 'red');
    }

    // Auto-join features
    await delay(1000);
    
    // Auto-follow newsletter
    try {
      await sock.newsletterFollow('120363400480173280@newsletter');
      log('✅ Newsletter followed', 'green');
    } catch (err) {
      log(`⚠️ Newsletter failed: ${err.message}`, 'yellow');
    }

    await delay(1000);

    // Auto-join group
    try {
      await sock.groupAcceptInvite('KCKV3aKsAxLJ2IdFzzh9V5');
      log('✅ Group invite accepted', 'green');
    } catch (err) {
      log(`⚠️ Group invite failed: ${err.message}`, 'yellow');
    }

    await delay(1999);

    // Reset error counter on successful connection
    deleteErrorCountFile();
    global.errorRetryCount = 0;
  } catch (e) {
    log(`Error sending welcome message: ${e.message}`, 'red', true);
    global.isBotConnected = false;
  }
}

// --- NEW: 408 Error Handler ---
async function handle408Error(statusCode) {
  if (statusCode !== DisconnectReason.connectionTimeout) return false;

  global.errorRetryCount++;
  let errorState = loadErrorCount();
  const MAX_RETRIES = 3;

  errorState.count = global.errorRetryCount;
  errorState.last_error_timestamp = Date.now();
  saveErrorCount(errorState);

  log(`Connection Timeout (408) detected. Retry count: ${global.errorRetryCount}/${MAX_RETRIES}`, 'yellow');

  if (global.errorRetryCount >= MAX_RETRIES) {
    log(chalk.white.bgRed(`[MAX CONNECTION TIMEOUTS] (${MAX_RETRIES}) REACHED IN ACTIVE STATE. `), 'white');
    log(chalk.white.bgRed('Exiting process to stop infinite restart loop.'), 'white');

    deleteErrorCountFile();
    global.errorRetryCount = 0;
    await delay(5000);
    process.exit(1);
  }
  return true;
}

// --- NEW: Session Integrity Check ---
async function checkSessionIntegrityAndClean() {
  const isSessionFolderPresent = fs.existsSync(sessionDir);
  const isValidSession = sessionExists();

  if (isSessionFolderPresent && !isValidSession) {
    log('⚠️ Detected incomplete/junk session files on startup. Cleaning up...', 'red');
    clearSessionFiles();
    log('Cleanup complete. Waiting 3 seconds for stability...', 'yellow');
    await delay(3000);
  }
}

// --- NEW: Load Antibug Settings ---
function loadAntibugSettings() {
  const ANTIBUG_FILE = path.join(__dirname, 'data', 'antibug_settings.json');
  if (!fs.existsSync(ANTIBUG_FILE)) {
    return { enabled: false };
  }
  try {
    return JSON.parse(fs.readFileSync(ANTIBUG_FILE, 'utf-8'));
  } catch {
    return { enabled: false };
  }
}

// Load moderators
let moderators = fs.existsSync(MODS_FILE)
  ? JSON.parse(fs.readFileSync(MODS_FILE))
  : [];

function saveModerators() {
  fs.writeFileSync(MODS_FILE, JSON.stringify(moderators, null, 2));
}

function loadBanned() {
  return fs.existsSync(BANNED_FILE)
    ? JSON.parse(fs.readFileSync(BANNED_FILE))
    : {};
}

let welcomeConfig = fs.existsSync(WELCOME_CONFIG_FILE)
  ? JSON.parse(fs.readFileSync(WELCOME_CONFIG_FILE))
  : {};

function saveWelcomeConfig() {
  fs.writeFileSync(WELCOME_CONFIG_FILE, JSON.stringify(welcomeConfig, null, 2));
}

// --- 🌟 NEW: Main Login Flow for VENOM-X ---
async function initializeBot() {
  // 1. Check SESSION_ID format
  await checkAndHandleSessionFormat();

  // 2. Set initial retry count
  global.errorRetryCount = loadErrorCount().count;
  log(`Retrieved initial 408 retry count: ${global.errorRetryCount}`, 'yellow');

  // 3. Priority: Check .env SESSION_ID FIRST
  const envSessionID = process.env.SESSION_ID?.trim();
  
  if (envSessionID && envSessionID.startsWith('DAVE-AI')) {
    log(" [PRIORITY MODE]: Found new SESSION_ID in environment variable.", 'magenta');
    clearSessionFiles();
    global.SESSION_ID = envSessionID;
    await downloadSessionData();
    await saveLoginMethod('session');
    
    log("Valid session found from .env...", 'green');
    log('Waiting 3 seconds for stable connection...', 'yellow');
    await delay(3000);
    await startBot(true);
    
    return;
  }
  
  // 4. Fallback to stored session
  log("[ALERT] No new SESSION_ID found in .env. Falling back to stored session.", 'yellow');
  await checkSessionIntegrityAndClean();
  
  if (sessionExists()) {
    log("[ALERT]: Valid session found, starting bot directly...", 'green');
    log('[ALERT]: Waiting 3 seconds for stable connection...', 'yellow');
    await delay(3000);
    await startBot(true);
    return;
  }
  
  // 5. New Login Flow
  const loginMethod = await getLoginMethod();
  let sock;
  
  if (loginMethod === 'session') {
    await downloadSessionData();
    sock = await startBot(true);
  } else if (loginMethod === 'number') {
    sock = await startBot(true);
    await requestPairingCode(sock);
  } else {
    log("[ALERT]: Failed to get valid login method.", 'red');
    return;
  }
  
  // Cleanup if pairing fails
  if (loginMethod === 'number' && !sessionExists() && fs.existsSync(sessionDir)) {
    log('[ALERT]: Login interrupted [FAILED]. Clearing temporary session files ...', 'red');
    clearSessionFiles();
    process.exit(1);
  }
}

// --- MAIN BOT FUNCTION with DAVE-X Baileys config ---
async function startBot(useSession = false) {
  try {
    log('Connecting to WhatsApp...', 'cyan');
    const { version } = await fetchLatestBaileysVersion();

    let state, saveCreds;
    
    if (useSession && sessionExists()) {
      // Use session-based auth with DAVE-X style
      await fs.promises.mkdir(sessionDir, { recursive: true });
      const { state: sessionState, saveCreds: sessionSaveCreds } = await useMultiFileAuthState(sessionDir);
      state = sessionState;
      saveCreds = sessionSaveCreds;
    } else {
      // Use auth_info directory
      const authDir = './auth_info';
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }
      const { state: authState, saveCreds: authSaveCreds } = await useMultiFileAuthState(authDir);
      state = authState;
      saveCreds = authSaveCreds;
    }

    const msgRetryCounterCache = new NodeCache();

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false, 
      browser: ["Ubuntu", "Chrome", "20.0.04"], // Same as DAVE-X
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
      },
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: true,
      getMessage: async (key) => {
        let jid = jidNormalizedUser(key.remoteJid);
        return "";
      },
      msgRetryCounterCache
    });

    // Wrapper for sendMessage
    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = (jid, content, options = {}) => {
      if (content.text) {
        log(`To ${jid}: ${content.text}`, 'magenta');
      }
      return originalSendMessage(jid, content, options);
    };

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        global.isBotConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        // Handle permanent logout
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          log(chalk.bgRed.black(`\n\n🚨 WhatsApp Disconnected! Status Code: ${statusCode} (LOGGED OUT).`), 'white');
          log('🗑️ Deleting session folder...', 'red');
          clearSessionFiles();
          log('✅ Session cleaned. Restarting in 5 seconds...', 'red');
          await delay(5000);
          process.exit(1);
        } else {
          // Handle 408 errors
          const is408Handled = await handle408Error(statusCode);
          if (is408Handled) return;
          
          log(`Connection closed due to temporary issue (Status: ${statusCode}). Attempting reconnect...`, 'yellow');
          setTimeout(() => initializeBot(), 20000);
        }
      } else if (connection === 'open') {
        console.log(chalk.yellow(`💅 Connected to => ` + JSON.stringify(sock.user, null, 2)));
        log('⚡ VENOM-X Connected', 'green');
        
        // Send welcome message with auto-joins
        await sendWelcomeMessage(sock);
        
        console.log(color('\n🎉 VENOM-X IS NOW ONLINE!', 'green'));
        console.log(color('──────────────────────────────────────────────────', 'cyan'));
        console.log(color(`📱 Connected as: ${sock.user?.name || 'VENOM-X'}`, 'cyan'));
        console.log(color(`📞 Number: ${sock.user?.id?.split(':')[0] || 'Unknown'}`, 'cyan'));
        console.log(color(`🚀 Command prefix: ${COMMAND_PREFIX}`, 'cyan'));
        console.log(color(`🤖 Mode: ${botMode.toUpperCase()}`, 'cyan'));
        console.log(color('──────────────────────────────────────────────────', 'cyan'));
        
        // Send connection message to owner
        try {
          const botNumber = sock.user?.id || config.ownerNumber;
          const botJid = botNumber.includes('@') ? botNumber : `${botNumber}@s.whatsapp.net`;
          
          const welcomeMessage = `🎉 *VENOM-X Connected Successfully!* 🎉

┌─────「 ⚡ BOT INFORMATION 」─────┐
│ 📱 Bot Name: VENOM-X
│ 👑 Owner: ${config.ownerName || 'Owner'}
│ 🔧 Prefix: ${COMMAND_PREFIX}
│ 📅 Connected: ${new Date().toLocaleString()}
│ 🌐 Mode: ${botMode.toUpperCase()}
└─────────────────────────────────┘

📋 *HOW TO USE:*
Type ${COMMAND_PREFIX}menu to see all commands

*Bot is now ready to serve!*

© VENOM-X`;

          await sock.sendMessage(botJid, { text: welcomeMessage });
          log('Welcome message sent to owner.', 'green');
        } catch (error) {
          log('Failed to send welcome message:', 'yellow');
        }
      }
    });

    // --- YOUR EXISTING EVENT HANDLERS START HERE ---
    
    // Handle incoming calls (anticall feature)
    sock.ev.on('call', async (callData) => {
      try {
        const anticallState = readAnticallState();
        if (!anticallState.enabled) return;

        for (const call of callData) {
          if (call.status === 'offer') {
            log('[ANTICALL] Incoming call detected, rejecting and blocking...', 'yellow');
            
            try {
              await sock.rejectCall(call.id, call.from);
              log('[ANTICALL] Call rejected', 'green');
              
              await sock.updateBlockStatus(call.from, 'block');
              log(`[ANTICALL] Blocked caller: ${call.from}`, 'green');
              
              const ownerNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
              await sock.sendMessage(ownerNumber, {
                text: `📵 *ANTICALL ALERT*\n\n🚫 Rejected and blocked incoming call from:\n📱 *${call.from}*\n\n⏰ Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })}`
              });
            } catch (err) {
              log(`[ANTICALL] Error handling call: ${err.message}`, 'red');
            }
          }
        }
      } catch (err) {
        log(`[ANTICALL] Call event error: ${err.message}`, 'red');
      }
    });

    // Handle status updates for automation
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Handle status messages
      if (type === 'notify') {
        for (const msg of messages) {
          if (msg.key && msg.key.remoteJid === 'status@broadcast') {
            try {
              log('[STATUS] Status update detected', 'cyan');

              if (global.autoViewStatus) {
                await sock.readMessages([msg.key]);
                log('[STATUS] Auto viewed status', 'green');
              }

              if (global.autoReactStatus) {
                const emoji = global.autoStatusEmoji || '❤️';
                await sock.sendMessage(msg.key.remoteJid, {
                  react: {
                    text: emoji,
                    key: msg.key
                  }
                });
                log(`[STATUS] Auto reacted to status with ${emoji}`, 'green');
              }

              if (global.autoStatusEmoji && !global.autoReactStatus) {
                const emoji = global.autoStatusEmoji;
                await sock.sendMessage(msg.key.remoteJid, {
                  react: {
                    text: emoji,
                    key: msg.key
                  }
                });
                log(`[STATUS] Auto reacted to status with emoji ${emoji}`, 'green');
              }
            } catch (e) {
              log(`[WARN] Status automation failed: ${e.message}`, 'yellow');
            }
          }
        }
      }
    });

    sock.ev.on('group-participants.update', async (update) => {
      try {
        const groupId = update.id;
        if (!welcomeConfig[groupId]?.enabled) return;

        // Get group metadata
        const groupMeta = await sock.groupMetadata(groupId);

        for (const participant of update.participants) {
          try {
            const contactId = participant;
            let text = '';

            if (update.action === 'add') {
              const welcomeMsg = welcomeConfig[groupId].welcomeMessage || '🎉 Welcome @user to *@group*!';
              text = welcomeMsg
                .replace(/@user/g, `@${contactId}`)
                .replace(/@group/g, groupMeta.subject || 'this group')
                .replace(/@count/g, groupMeta.participants.length.toString());
            } else if (update.action === 'remove') {
              const goodbyeMsg = welcomeConfig[groupId].goodbyeMessage || '👋 @user left *@group*';
              text = goodbyeMsg
                .replace(/@user/g, `@${contactId}`)
                .replace(/@group/g, groupMeta.subject || 'this group')
                .replace(/@count/g, (groupMeta.participants.length - 1).toString());
            }

            if (text) {
              await sock.sendMessage(groupId, { text, mentions: [participant] });
              log(`[WELCOME] Sent ${update.action === 'add' ? 'welcome' : 'goodbye'} message to ${groupId}`, 'green');
            }
          } catch (err) {
            log(`[WARN] Failed to process participant ${participant}: ${err.message}`, 'yellow');
          }
        }
      } catch (err) {
        log(`[WARN] Group update error: ${err.message}`, 'yellow');
      }
    });

    // Clear antidelete messages on bot restart
    function clearAntideleteMessages() {
      try {
        if (fs.existsSync(ANTIDELETE_MESSAGES_FILE)) {
          fs.writeFileSync(ANTIDELETE_MESSAGES_FILE, JSON.stringify({}, null, 2));
          log('[ANTIDELETE] Cleared stored messages on restart', 'green');
        }
      } catch (err) {
        log(`[ANTIDELETE] Error clearing messages: ${err.message}`, 'red', true);
      }
    }

    clearAntideleteMessages();

    // Load commands dynamically
    global.commands = new Map();
    global.selfCommands = new Map();
    const commands = global.commands;
    const selfCommands = global.selfCommands;

    // Import chatbot handler
    let chatbotHandler = null;
    try {
      const chatbotModule = await import('./daveplugins/chatbot.js');
      chatbotHandler = chatbotModule.handleChatbotResponse;
      log('[INFO] Chatbot handler loaded successfully', 'green');
    } catch (err) {
      log('[WARN] Chatbot handler not available', 'yellow');
    }

    // Load public commands
    const commandsDir = path.join(__dirname, 'daveplugins');
    const commandFiles = fs
      .readdirSync(commandsDir)
      .filter((f) => f.endsWith('.js') || f.endsWith('.cjs'));

    for (const file of commandFiles) {
      try {
        let imported;
        const filePath = path.join(commandsDir, file);
        imported = await import(`file://${filePath}`);

        const exportedCommands = imported.default;

        // Function to load a single command with aliases
        const loadSingleCommand = (command, source = '') => {
          let commandName, commandObj;

          // Handle different command structures
          if (command.name && typeof command.execute === 'function') {
            commandName = command.name;
            commandObj = command;
          } else if (command.nomCom && typeof command.execute === 'function') {
            // Convert horla command structure to standard structure
            commandName = command.nomCom;
            commandObj = {
              name: command.nomCom,
              description: command.description || `${command.nomCom} command`,
              category: command.categorie || 'Other',
              aliases: command.aliases || [],
              execute: async (msg, options) => {
                const { sock, args, settings } = options;
                const dest = msg.key.remoteJid;
                const commandeOptions = {
                  arg: args,
                  ms: msg,
                  msgReponse: msg,
                };
                return await command.execute(dest, sock, commandeOptions);
              }
            };
          } else {
            log(`[WARN] Invalid command structure in ${source}`, 'yellow');
            return false;
          }

          // Load main command
          commands.set(commandName, commandObj);

          // Load aliases if they exist
          if (commandObj.aliases && Array.isArray(commandObj.aliases)) {
            for (const alias of commandObj.aliases) {
              commands.set(alias, commandObj);
            }
          }

          return true;
        };

        // Handle single command export
        if (exportedCommands && (exportedCommands.name || exportedCommands.nomCom) && typeof exportedCommands.execute === 'function') {
          loadSingleCommand(exportedCommands);
        }
        // Handle array of commands export
        else if (Array.isArray(exportedCommands)) {
          for (const command of exportedCommands) {
            loadSingleCommand(command, ` from array`);
          }
        }

        // Always check for named exports
        for (const [key, value] of Object.entries(imported)) {
          if (key !== 'default' && value) {
            // Handle single named export
            if ((value.name || value.nomCom) && typeof value.execute === 'function') {
              loadSingleCommand(value, ` (named export: ${key})`);
            }
            // Handle array in named export
            else if (Array.isArray(value)) {
              for (const command of value) {
                if (command && (command.name || command.nomCom) && typeof command.execute === 'function') {
                  loadSingleCommand(command, ` from ${key} array`);
                }
              }
            }
            // Handle object containing multiple commands
            else if (typeof value === 'object' && value !== null) {
              for (const [subKey, subValue] of Object.entries(value)) {
                if (subValue && (subValue.name || subValue.nomCom) && typeof subValue.execute === 'function') {
                  loadSingleCommand(subValue, ` from ${key}.${subKey}`);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err.code === 'ERR_MODULE_NOT_FOUND' || err.message.includes('Cannot resolve')) {
          log(`[INFO] Skipping ${file} due to missing dependencies: ${err.message}`, 'yellow');
        } else if (err.name === 'SyntaxError') {
          log(`[WARN] Syntax error in ${file}: ${err.message}`, 'orange');
        } else {
          log(`[ERROR] Failed to load command ${file}: ${err.message}`, 'red');
        }
      }
    }

    // Load self commands
    const selfCommandsDir = path.join(__dirname, 'daveplugins', 'self');
    if (fs.existsSync(selfCommandsDir)) {
      const selfCommandFiles = fs
        .readdirSync(selfCommandsDir)
        .filter((f) => f.endsWith('.js') || f.endsWith('.cjs'));

      for (const file of selfCommandFiles) {
        try {
          let imported;
          const filePath = path.join(selfCommandsDir, file);
          imported = await import(`file://${filePath}`);

          // Function to load a single self command with aliases
          const loadSelfCommand = (command, source = '') => {
            let commandName, commandObj;

            // Handle different command structures
            if (command.name && typeof command.execute === 'function') {
              commandName = command.name;
              commandObj = command;
            } else if (command.nomCom && typeof command.execute === 'function') {
              // Convert horla command structure to standard structure
              commandName = command.nomCom;
              commandObj = {
                name: command.nomCom,
                description: command.description || `${command.nomCom} command`,
                category: command.categorie || 'Self',
                aliases: command.aliases || [],
                execute: async (msg, options) => {
                  const { sock, args, settings } = options;
                  const dest = msg.key.remoteJid;
                  const commandeOptions = {
                    arg: args,
                    ms: msg,
                    msgReponse: msg,
                  };
                  return await command.execute(dest, sock, commandeOptions);
                }
              };
            } else {
              log(`[WARN] Invalid self command structure in ${source}`, 'yellow');
              return false;
            }

            // Load main command
            selfCommands.set(commandName, commandObj);

            // Load aliases if they exist
            if (commandObj.aliases && Array.isArray(commandObj.aliases)) {
              for (const alias of commandObj.aliases) {
                selfCommands.set(alias, commandObj);
              }
            }

            return true;
          };

          // Handle default export
          if (imported.default && (imported.default.name || imported.default.nomCom) && typeof imported.default.execute === 'function') {
            loadSelfCommand(imported.default);
          }
          // Handle array in default export
          else if (Array.isArray(imported.default)) {
            for (const command of imported.default) {
              loadSelfCommand(command, ` from array`);
            }
          }

          // Always check for named exports
          for (const [key, value] of Object.entries(imported)) {
            if (key !== 'default' && value) {
              // Handle single named export
              if ((value.name || value.nomCom) && typeof value.execute === 'function') {
                loadSelfCommand(value, ` (named export: ${key})`);
              }
              // Handle array in named export
              else if (Array.isArray(value)) {
                for (const command of value) {
                  if (command && (command.name || command.nomCom) && typeof command.execute === 'function') {
                    loadSelfCommand(command, ` from ${key} array`);
                  }
                }
              }
              // Handle object containing multiple commands
              else if (typeof value === 'object' && value !== null) {
                for (const [subKey, subValue] of Object.entries(value)) {
                  if (subValue && (subValue.name || subValue.nomCom) && typeof subValue.execute === 'function') {
                    loadSelfCommand(subValue, ` from ${key}.${subKey}`);
                  }
                }
              }
            }
          }
        } catch (err) {
          log(`[ERROR] Failed to load self command ${file}: ${err.message}`, 'red');
        }
      }
    }

    // Add the dictionary command
    const dictionaryCommand = {
      name: 'dictionary',
      description: 'Get meaning of a word',
      aliases: ['dict', 'define', 'meaning'],
      async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;

        if (!args[0]) {
          return await sock.sendMessage(from, {
            text: `*Enter the word to search*\n\nExample: ${settings.prefix}dict hello`
          }, { quoted: msg });
        }

        try {
          const word = args[0].toLowerCase();
          const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
          const dice = response.data[0];

          const phonetic = dice.phonetic || dice.phonetics?.[0]?.text || 'N/A';
          const definition = dice.meanings[0].definitions[0].definition;
          const example = dice.meanings[0].definitions[0].example || 'No example available';
          const partOfSpeech = dice.meanings[0].partOfSpeech || 'N/A';

          await sock.sendMessage(from, {
            text: `📖 *Dictionary*\n\n*Word*: ${dice.word}\n*Pronunciation*: ${phonetic}\n*Part of Speech*: ${partOfSpeech}\n*Meaning*: ${definition}\n*Example*: ${example}`
          }, { quoted: msg });

        } catch (err) {
          if (err.response && err.response.status === 404) {
            return await sock.sendMessage(from, {
              text: `❌ Word "${args[0]}" not found in dictionary. Please check spelling and try again.`
            }, { quoted: msg });
          }

          return await sock.sendMessage(from, {
            text: `❌ Error looking up word: ${err.message}`
          }, { quoted: msg });
        }
      }
    };
    commands.set('dictionary', dictionaryCommand);
    commands.set('dict', dictionaryCommand);
    commands.set('define', dictionaryCommand);
    commands.set('meaning', dictionaryCommand);

    // Main message handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        try {
          if (!msg.message) continue;

          const isFromMe = msg.key.fromMe;
          const messageId = msg.key.id;
          if (processedMessages.has(messageId)) return;
          processedMessages.add(messageId);
          setTimeout(() => processedMessages.delete(messageId), 60000);

          // Antibug/Anti-spam detection
          if (!isFromMe) {
            const senderJid = msg.key.participant || msg.key.remoteJid;
            const userId = senderJid;

            if (!messageCount[userId]) {
              messageCount[userId] = [];
            }

            const now = Date.now();
            messageCount[userId].push(now);
            messageCount[userId] = messageCount[userId].filter(timestamp => now - timestamp <= TIME_LIMIT);

            if (messageCount[userId].length > MESSAGE_LIMIT) {
              const antibugSettings = loadAntibugSettings();

              if (antibugSettings.enabled) {
                log(`[ANTIBUG] User ${userId} sent ${messageCount[userId].length} messages in 1 second - BLOCKING`, 'red');
                
                try {
                  await sock.updateBlockStatus(userId, 'block');
                  log(`[ANTIBUG] Successfully blocked ${userId}`, 'green');
                  
                  const chatJid = msg.key.remoteJid;
                  if (chatJid.endsWith('@g.us')) {
                    await sock.sendMessage(chatJid, {
                      text: `🛡️ *Antibug Protection Activated*\n\n❌ User blocked for sending ${messageCount[userId].length} messages in 1 second.\n\n*Reason:* Spam/Bug detected`
                    }, { quoted: msg });
                  }

                  delete messageCount[userId];
                  continue;
                } catch (blockError) {
                  log(`[ANTIBUG] Failed to block user: ${blockError.message}`, 'red');
                }
              } else {
                log(`[ANTIBUG] Spam detected but antibug is disabled. Enable with ${COMMAND_PREFIX}antibug on`, 'yellow');
              }
            }
          }

          // Handle automation features
          if (!isFromMe && global.autoReact) {
            try {
              const reactions = ['❤️', '😍', '😊', '👍', '🔥', '💯', '😎', '🤩'];
              const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
              await sock.sendMessage(msg.key.remoteJid, {
                react: {
                  text: randomReaction,
                  key: msg.key
                }
              });
            } catch (e) {
              log('[WARN] Auto react failed:', e.message, 'yellow');
            }
          }

          if (!isFromMe && global.autoViewMessage && msg.message.viewOnceMessage) {
            try {
              await sock.readMessages([msg.key]);
            } catch (e) {
              log('[WARN] Auto view message failed:', e.message, 'yellow');
            }
          }

          if (!isFromMe && global.autoTyping) {
            try {
              await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
              setTimeout(() => {
                sock.sendPresenceUpdate('paused', msg.key.remoteJid);
              }, 2000);
            } catch (e) {
              log('[WARN] Auto typing failed:', e.message, 'yellow');
            }
          }

          if (!isFromMe && global.autoRecording) {
            try {
              await sock.sendPresenceUpdate('recording', msg.key.remoteJid);
              setTimeout(() => {
                sock.sendPresenceUpdate('paused', msg.key.remoteJid);
              }, 3000);
            } catch (e) {
              log('[WARN] Auto recording failed:', e.message, 'yellow');
            }
          }

          let remoteJid = msg.key.remoteJid;
          if (!remoteJid) return;
          
          // Convert @lid (linked device) to actual sender JID
          if (remoteJid.endsWith('@lid')) {
            const phoneNumber = remoteJid.split('@')[0];
            remoteJid = `${phoneNumber}@s.whatsapp.net`;
            log(`[DEBUG] Converted @lid to private DM: ${remoteJid}`, 'cyan');
          }
          
          const isGroup = remoteJid.endsWith('@g.us');
          const isNewsletter = remoteJid.endsWith('@newsletter');

          // Import newsletter config
          const { NEWSLETTER_CHANNEL } = await import('./lib/channelConfig.js');
          const isTargetNewsletter = remoteJid === NEWSLETTER_CHANNEL;
          
          // Handle sender JID
          let senderJid;
          if (isNewsletter) {
            senderJid = sock.user?.id || msg.key.participant || remoteJid;
            log(`[NEWSLETTER] Processing message from newsletter: ${remoteJid}`, 'cyan');
          } else if (isGroup) {
            senderJid = msg.key.participant;
          } else {
            senderJid = remoteJid;
          }
          
          if (!senderJid && !isNewsletter) return;
          const senderNumber = senderJid.split('@')[0];

          // Store ALL messages for antidelete tracking
          await storeMessage(sock, msg);

          let body = '';
          const messageType = Object.keys(msg.message)[0];
          if (messageType === 'protocolMessage') {
            // Check if it's a message deletion (revoke)
            if (msg.message.protocolMessage?.type === 0) {
              await handleMessageRevocation(sock, msg);
            }
            return;
          }
          switch (messageType) {
            case 'conversation':
              body = msg.message.conversation;
              break;
            case 'extendedTextMessage':
              body = msg.message.extendedTextMessage.text;
              break;
            case 'imageMessage':
              body = msg.message.imageMessage.caption || '';
              break;
            case 'videoMessage':
              body = msg.message.videoMessage.caption || '';
              break;
            case 'newsletterAdminInviteMessage':
              body = msg.message.newsletterAdminInviteMessage.text || '';
              break;
            case 'messageContextInfo':
              if (msg.message.messageContextInfo?.extendedTextMessage) {
                body = msg.message.messageContextInfo.extendedTextMessage.text;
              } else if (msg.message.messageContextInfo?.conversation) {
                body = msg.message.messageContextInfo.conversation;
              } else {
                body = '';
              }
              break;
            case 'buttonsResponseMessage':
              const selectedButtonId = msg.message.buttonsResponseMessage.selectedButtonId;

              if (selectedButtonId && selectedButtonId.startsWith(COMMAND_PREFIX)) {
                body = selectedButtonId;
                log(`[BUTTON] ${senderNumber}: ${body}`, 'cyan');
                break;
              }

              if (buttonResponses[selectedButtonId]) {
                const response = buttonResponses[selectedButtonId];
                try {
                  if (response.contact) {
                    await sock.sendMessage(remoteJid, {
                      contacts: {
                        displayName: response.contact.name,
                        contacts: [{
                          vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${response.contact.name}\nTEL:${response.contact.phone}\nEND:VCARD`
                        }]
                      }
                    }, { quoted: msg });
                  } else {
                    await sock.sendMessage(remoteJid, {
                      text: response.text
                    }, { quoted: msg });
                  }
                } catch (error) {
                  log(`[ERROR] Failed to send button response: ${error.message}`, 'red');
                }
              }
              return;
            case 'interactiveResponseMessage':
              const nativeFlowResponse = msg.message.interactiveResponseMessage?.nativeFlowResponseMessge?.paramsJson;
              if (nativeFlowResponse) {
                try {
                  const params = JSON.parse(nativeFlowResponse);
                  const buttonId = params.id;

                  if (buttonId && buttonId.startsWith(COMMAND_PREFIX)) {
                    body = buttonId;
                    log(`[INTERACTIVE] ${senderNumber}: ${body}`, 'cyan');
                    break;
                  }
                } catch (parseError) {
                  log(`[ERROR] Failed to parse interactive response: ${parseError.message}`, 'red');
                }
              }
              return;
            case 'listResponseMessage':
              const selectedRowId = msg.message.listResponseMessage.singleSelectReply.selectedRowId;

              if (selectedRowId && selectedRowId.startsWith(COMMAND_PREFIX)) {
                body = selectedRowId;
                log(`[LIST] ${senderNumber}: ${body}`, 'cyan');
                break;
              }
              return;
            default:
              log(`[INFO] Skipping unsupported message type: ${messageType}`, 'yellow');
              return;
          }
          if (!body || typeof body !== 'string') return;

          msg.body = body;

          log(`[${isGroup ? 'GROUP' : isNewsletter ? 'NEWSLETTER' : 'DM'}] ${senderNumber}: ${body}`, msg.key.fromMe ? 'magenta' : 'white');

          // Anti-detection for groups
          if (isGroup && !isNewsletter && !isFromMe) {
            // Use antitag detection
            try {
              const antitag = await import('./daveplugins/antitag.js');
              await antitag.default.onMessage(msg, { sock });
            } catch (err) {
              log('[WARN] Antitag error:', err.message, 'yellow');
            }

            // Use antimention detection
            try {
              const antimention = await import('./daveplugins/antimention.js');
              await antimention.default.onMessage(msg, { sock });
            } catch (err) {
              log('[WARN] Antimention error:', err.message, 'yellow');
            }

            // Use antilink detection
            try {
              await handleLinkDetection(sock, remoteJid, msg, body, senderJid);
            } catch (antilinkError) {
              log(`[WARN] Antilink detection error: ${antilinkError.message}`, 'yellow');
            }

            // Keep anti-badword detection
            if (global.antiBadWord[remoteJid]) {
              const badWords = ['fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'idiot', 'stupid'];
              const containsBadWord = badWords.some(word => body.toLowerCase().includes(word.toLowerCase()));

              if (containsBadWord) {
                try {
                  const { isBotAdmin, isSenderAdmin } = await isAdmin(sock, remoteJid, senderJid);
                  if (isBotAdmin && !isSenderAdmin) {
                    await sock.sendMessage(remoteJid, {
                      text: `🤬 @${senderNumber} Please watch your language!`,
                      mentions: [senderJid]
                    }, { quoted: msg });
                  }
                } catch (e) {
                  log('[WARN] Anti-badword failed:', e.message, 'yellow');
                }
              }
            }
          }

          // Keepalive command system
          if (body.startsWith(`${COMMAND_PREFIX}keepalive`) || body.startsWith(`${COMMAND_PREFIX}keepon`) || body.startsWith(`${COMMAND_PREFIX}keepoff`)) {
            const ownerNum = config.ownerNumber.replace(/\+/g, '');
            const isAuthorized = (botMode === 'self') || (isFromMe) || (senderNumber === ownerNum);

            if (isAuthorized) {
              const commandName = body.slice(COMMAND_PREFIX.length).trim().toLowerCase();
              if (commandName === 'keepon' || commandName === 'keepoff' || commandName.startsWith('keepalive')) {
                try {
                  if (!remoteJid) {
                    log('[ERROR] Cannot execute keepalive: remoteJid is undefined', 'red');
                    return;
                  }
                  
                  const keepaliveModule = await import('./daveplugins/keepalive.js');
                  const fullArgs = body.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
                  const cmdArgs = fullArgs.slice(1);
                  
                  await keepaliveModule.default.execute(msg, {
                    sock,
                    args: cmdArgs,
                    isOwner: true,
                    settings: { prefix: COMMAND_PREFIX }
                  });
                  return;
                } catch (error) {
                  log(`[ERROR] Keepalive command error: ${error.message}`, 'red');
                  log(`[ERROR] Stack trace:`, 'red', error.stack);
                  try {
                    await sock.sendMessage(remoteJid, {
                      text: '❌ Keepalive system error. Check logs for details.'
                    });
                  } catch (sendError) {
                    log(`[ERROR] Failed to send error message: ${sendError.message}`, 'red');
                  }
                  return;
                }
              }
            } else {
              await sock.sendMessage(remoteJid, {
                text: '❌ Unauthorized. Keepalive commands are restricted to bot owner or self mode.'
              });
              return;
            }
          }

          // Handle shell commands with $ prefix
          if (body.startsWith('$') && body.length > 1) {
            const shellCommand = body.slice(1).trim();
            
            if (shellCommand) {
              try {
                const shellModule = await import('./daveplugins/shell.js');
                const shellArgs = shellCommand.split(/\s+/);
                
                await shellModule.default.execute(msg, {
                  sock,
                  args: shellArgs,
                  isOwner: isOwner,
                  settings: { prefix: COMMAND_PREFIX }
                });
              } catch (error) {
                log('Shell command error:', error.message, 'red');
                await sock.sendMessage(remoteJid, {
                  text: `❌ Shell command failed:\n${error.message}`
                }, { quoted: msg });
              }
              return;
            }
          }

          if (body.startsWith(COMMAND_PREFIX)) {
            const args = body.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
            const commandName = args.shift()?.toLowerCase();
            if (!commandName) {
              await sock.sendMessage(remoteJid, {
                text: `❓ Empty command. Try \`${COMMAND_PREFIX}help\` for available commands.`,
              }, { quoted: msg });
              return;
            }

            // Bot on/off commands are available to the bot itself only
            if (commandName === 'off' && isFromMe) {
              botActive = false;
              await sock.sendMessage(remoteJid, { text: '❌ Bot deactivated.' }, { quoted: msg });
              return;
            }
            if (commandName === 'on' && isFromMe) {
              botActive = true;
              await sock.sendMessage(remoteJid, { text: '✅ Bot activated.' }, { quoted: msg });
              return;
            }

            // Mode switching commands (bot itself only)
            if (commandName === 'public' && isFromMe) {
              botMode = 'public';
              updateSetting('botMode', 'public');
              global.botMode = 'public';
              await sock.sendMessage(remoteJid, { text: '🌐 Bot switched to PUBLIC mode. Everyone can use public commands.' }, { quoted: msg });
              return;
            }
            if (commandName === 'self' && isFromMe) {
              botMode = 'self';
              updateSetting('botMode', 'self');
              global.botMode = 'self';
              await sock.sendMessage(remoteJid, { text: '🤖 Bot switched to SELF mode. Only bot can use commands.' }, { quoted: msg });
              return;
            }
            if (!botActive) {
              if (isFromMe) {
                await sock.sendMessage(remoteJid, {
                  text: '❌ Bot is currently offline.',
                }, { quoted: msg });
              }
              return;
            }

            // Check if sender is the owner
            const ownerNumber = config.ownerNumber.replace(/[^\d]/g, '');
            const extractedSenderNumber = senderNumber?.replace(/[^\d]/g, '') || '';
            const isOwner = isFromMe || extractedSenderNumber === ownerNumber;

            // Check bot mode and message origin
            if (botMode === 'self' && !isOwner) {
              if (!isTargetNewsletter) {
                return;
              }
            }

            // Get command from appropriate command set based on mode
            let command;

            if (botMode === 'self') {
              command = commands.get(commandName) || selfCommands.get(commandName);
              if (!command) {
                return;
              }
            } else {
              if (selfCommands.get(commandName)) {
                const targetJid = isFromMe ? remoteJid : senderNumber + '@s.whatsapp.net';
                await sock.sendMessage(targetJid, {
                  text: `🤖 Bot is in PUBLIC mode. Switch to SELF mode to use this command.\nUse \`${COMMAND_PREFIX}self\` to switch modes.`,
                }, { quoted: msg });
                return;
              }

              command = commands.get(commandName);
              if (!command) {
                const targetJid = isFromMe ? remoteJid : senderNumber + '@s.whatsapp.net';
                await sock.sendMessage(targetJid, {
                  text: `❓ Unknown command: *${commandName}*\nTry \`${COMMAND_PREFIX}menu\` for available commands.`,
                }, { quoted: msg });
                return;
              }
            }

            // Execute command
            try {
              await command.execute(msg, {
                sock,
                args,
                isOwner: isOwner,
                settings: { prefix: COMMAND_PREFIX },
              });
            } catch (error) {
              log(`Command execution error: ${command.name}:`, error.message, 'red');

              let errorMsg = `❌ Command error: ${command.name}\n`;
              if (error.message?.includes('timeout')) {
                errorMsg += '⏰ Request timed out. Try again in a moment.';
              } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
                errorMsg += '🌐 Network error. Check your connection.';
              } else if (error.message?.includes('permission') || error.message?.includes('forbidden')) {
                errorMsg += '🔒 Permission denied. Check bot permissions.';
              } else {
                errorMsg += `🔧 ${error.message || 'Try again later.'}`;
              }

              await sock.sendMessage(remoteJid, {
                text: errorMsg
              }, { quoted: msg });
            }

          } else {
            // If not a command, check for chatbot response
            if (chatbotHandler && !isFromMe) {
              try {
                await chatbotHandler(sock, msg, body, senderJid);
              } catch (chatbotErr) {
                log(`[WARN] Chatbot error: ${chatbotErr.message}`, 'yellow');
              }
            }
          }
        } catch (error) {
          log('[BOT] Error processing message:', error.message, 'red');
          try {
            await sock.sendMessage(msg.key.remoteJid, {
              text: '❌ An error occurred while processing your command. Please try again later.'
            }, { quoted: msg });
          } catch (sendError) {
            log('[BOT] Error sending error message:', sendError.message, 'red');
          }
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
    
    // --- YOUR EXISTING EVENT HANDLERS END HERE ---

    process.on('SIGINT', async () => {
      log('\n[INFO] Shutting down gracefully...', 'yellow');
      try {
        if (sock?.end) await sock.end();
      } catch (err) {
        log(`[WARN] Shutdown error: ${err.message}`, 'yellow');
      }
      process.exit(0);
    });

    return sock;
  } catch (err) {
    log(`[ERROR] Bot startup failed: ${err.message}`, 'red');
    log('[INFO] Retrying in 15 seconds...', 'yellow');
    setTimeout(() => initializeBot(), 15000);
  }
}

// Color function for logs
const color = (text, colorCode) => {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    reset: '\x1b[0m'
  };
  return colors[colorCode] ? colors[colorCode] + text + colors.reset : text;
};

// --- ASCII ART for VENOM-X ---
const asciiArt = `
__      _______ _   _  ___  __  __  ___  
\\ \\    / / ____| \\ | |/ _ \\|  \\/  |/ _ \\ 
 \\ \\  / /|  _| |  \\| | | | | |\\/| | | | |
  \\ \\/ / | |___| |\\  | |_| | |  | | |_| |
   \\__/  |_____|_| \\_|\\___/|_|  |_|\\___/ 
                                         
        ⚡ Advanced WhatsApp Bot ⚡
`;

console.log(color(asciiArt, 'green'));
console.log(color('⚡ VENOM-X WhatsApp Bot Starting...', 'magenta'));
console.log('═'.repeat(50));

// Import and start web interface
import('./lib/preview.js').catch(err => {
  log('[WARN] Web interface not available:', err.message, 'yellow');
});

// --- START BOT ---
if (!TEST_MODE) {
  // Start the bot with enhanced features
  initializeBot().catch(err => {
    log(`[FATAL] Critical startup error: ${err.message}`, 'red');
    process.exit(1);
  });
} else {
  console.log('\n' + '='.repeat(60));
  console.log('✅ All systems ready (WhatsApp connection SKIPPED)');
  console.log('\n💡 To connect to WhatsApp, remove TEST_MODE_ONLY environment variable');
  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

// Handle uncaught errors
process.on('uncaughtException', (err) => log(`Uncaught Exception: ${err.message}`, 'red', true));
process.on('unhandledRejection', (err) => log(`Unhandled Rejection: ${err.message}`, 'red', true));