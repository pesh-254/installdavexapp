const path = require('path');
const fs = require('fs');
// Redirect temp storage away from system /tmp
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

// Auto-cleaner every 3 hours
setInterval(() => {
  fs.readdir(customTemp, (err, files) => {
    if (err) return;
    for (const file of files) {
      const filePath = path.join(customTemp, file);
      fs.stat(filePath, (err, stats) => {
        if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
          fs.unlink(filePath, () => {});
        }
      });
    }
  });
  console.log('🧹 Temp folder auto-cleaned');
}, 3 * 60 * 60 * 1000);

const originalWrite = process.stdout.write;
process.stdout.write = function (chunk, encoding, callback) {
    const message = chunk.toString();

    if (message.includes('Closing session: SessionEntry') || message.includes('SessionEntry {')) {
        return;
    }

    return originalWrite.apply(this, arguments);
};

const originalWriteError = process.stderr.write;
process.stderr.write = function (chunk, encoding, callback) {
    const message = chunk.toString();
    if (message.includes('Closing session: SessionEntry')) {
        return;
    }
    return originalWriteError.apply(this, arguments);
};

const originalLog = console.log;
console.log = function (message, ...optionalParams) {

    if (typeof message === 'string' && message.startsWith('Closing session: SessionEntry')) {
        return;
    }

    originalLog.apply(console, [message, ...optionalParams]);
};

/*━━━━━━━━━━━━━━━━━━━━*/
// -----Core imports first-----
/*━━━━━━━━━━━━━━━━━━━━*/
const settings = require('./settings');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const yts = require('yt-search');
const { fetchBuffer } = require('./lib/myfunc');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const chalk = require('chalk');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { jidDecode } = require('@whiskeysockets/baileys');
const { isSudo } = require('./lib/index');
const isAdmin = require('./lib/isAdmin');
const { Antilink } = require('./lib/antilink');
const { tictactoeCommand, handleTicTacToeMove } = require('./commands/tictactoe');

// Message handler utility
const {
    getMessageText,
    isEditedMessage,
    getEditedMessageText,
    extractCommand,
    shouldProcessEditedMessage
} = require('./lib/messageHandler');

/*━━━━━━━━━━━━━━━━━━━━*/
// -----Command imports - Handlers-----
/*━━━━━━━━━━━━━━━━━━━━*/
const { 
   autotypingCommand,
   isAutotypingEnabled,
   handleAutotypingForMessage,
   handleAutotypingForCommand, 
   showTypingAfterCommand
} = require('./commands/autotyping');

const {
  getPrefix, 
  handleSetPrefixCommand 
} = require('./commands/setprefix');

const {
  getOwnerName, 
  handleSetOwnerCommand 
} = require('./commands/setowner');

const {
 autoreadCommand,
 isAutoreadEnabled, 
 handleAutoread 
} = require('./commands/autoread');

const { 
 incrementMessageCount, 
 topMembers 
} = require('./commands/topmembers');

const { 
 setGroupDescription, 
 setGroupName, 
 setGroupPhoto 
} = require('./commands/groupmanage');

const { 
 handleAntilinkCommand, 
 handleLinkDetection 
} = require('./commands/antilink');

const { 
 handleAntitagCommand, 
 handleTagDetection
} = require('./commands/antitag');

const { 
 handleMentionDetection,
 mentionToggleCommand,
 setMentionCommand
} = require('./commands/mention');

const { 
 handleAntiBadwordCommand,
 handleBadwordDetection
} = require('./lib/antibadword');

const { 
 handleChatbotCommand,
 handleChatbotResponse
} = require('./commands/chatbot');

const { 
  welcomeCommand,
  handleJoinEvent
} = require('./commands/welcome');

const {
 goodbyeCommand,
 handleLeaveEvent
} = require('./commands/goodbye');

const {
 handleAntideleteCommand,
 handleMessageRevocation,
 storeMessage 
} = require('./commands/antidelete');

const {
 anticallCommand,
 readState: readAnticallState 
} = require('./commands/anticall');

const {
 pmblockerCommand, 
 readState: readPmBlockerState 
} = require('./commands/pmblocker');

const {
 addCommandReaction, 
 handleAreactCommand 
} = require('./lib/reactions');

const {
  autoStatusCommand, 
  handleStatusUpdate 
} = require('./commands/autostatus');

const {
 startHangman, 
 guessLetter 
} = require('./commands/hangman');

const {
 startTrivia, 
 answerTrivia 
} = require('./commands/trivia');

const {
 miscCommand, 
 handleHeart 
} = require('./commands/misc');

/*━━━━━━━━━━━━━━━━━━━━*/
// -----Command imports-----
/*━━━━━━━━━━━━━━━━━━━━*/
const wormgptCommand = require('./commands/wormgpt');
const getppCommand = require('./commands/getpp');
const tagAllCommand = require('./commands/tagall');
const helpCommand = require('./commands/help');
const banCommand = require('./commands/ban');
const { promoteCommand } = require('./commands/promote');
const { demoteCommand } = require('./commands/demote');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const stickerCommand = require('./commands/sticker');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const ttsCommand = require('./commands/tts');
const ownerCommand = require('./commands/owner');
const deleteCommand = require('./commands/delete');
const memeCommand = require('./commands/meme');
const tagCommand = require('./commands/tag');
const tagNotAdminCommand = require('./commands/tagnotadmin');
const hideTagCommand = require('./commands/hidetag');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const kickCommand = require('./commands/kick');
const simageCommand = require('./commands/simage');
const attpCommand = require('./commands/attp');
const { complimentCommand } = require('./commands/compliment');
const tostatusCommand = require('./commands/tostatus');
const broadcastCommand = require('./commands/broadcast');
const creategroupCommand = require('./commands/creategroup');
const linkgroupCommand = require('./commands/linkgroup');
const { insultCommand } = require('./commands/insult');
const { eightBallCommand } = require('./commands/eightball');
const channelidCommand = require('./commands/channelid');
const { lyricsCommand } = require('./commands/lyrics');
const { dareCommand } = require('./commands/dare');
const { truthCommand } = require('./commands/truth');
const { clearCommand } = require('./commands/clear');
const pingCommand = require('./commands/ping');
const aliveCommand = require('./commands/alive');
const blurCommand = require('./commands/img-blur');
const githubCommand = require('./commands/github');
const antibadwordCommand = require('./commands/antibadword');
const wallpaperCommand = require('./commands/wallpaper');
const takeCommand = require('./commands/take');
const { flirtCommand } = require('./commands/flirt');
const characterCommand = require('./commands/character');
const wastedCommand = require('./commands/wasted');
const shipCommand = require('./commands/ship');
const groupInfoCommand = require('./commands/groupinfo');
const resetlinkCommand = require('./commands/resetlink');
const staffCommand = require('./commands/staff');
const unbanCommand = require('./commands/unban');
const emojimixCommand = require('./commands/emojimix');
const { handlePromotionEvent } = require('./commands/promote');
const copilotCommand = require('./commands/copilot');
const { handleDemotionEvent } = require('./commands/demote');
const viewOnceCommand = require('./commands/viewonce');
const clearSessionCommand = require('./commands/clearsession');
const { simpCommand } = require('./commands/simp');
const { stupidCommand } = require('./commands/stupid');
const stickerTelegramCommand = require('./commands/stickertelegram');
const textmakerCommand = require('./commands/textmaker');
const clearTmpCommand = require('./commands/cleartmp');
const setProfilePicture = require('./commands/setpp');
const instagramCommand = require('./commands/instagram');
const facebookCommand = require('./commands/facebook');
const spotifyCommand = require('./commands/spotify');
const playCommand = require('./commands/play');
const tiktokCommand = require('./commands/tiktok');
const songCommand = require('./commands/song');
const aiCommand = require('./commands/ai');
const urlCommand = require('./commands/url');
const { handleTranslateCommand } = require('./commands/translate');
const { handleSsCommand } = require('./commands/ss');
const { goodnightCommand } = require('./commands/goodnight');
const { shayariCommand } = require('./commands/shayari');
const { rosedayCommand } = require('./commands/roseday');
const imagineCommand = require('./commands/imagine');
const videoCommand = require('./commands/video');
const sudoCommand = require('./commands/sudo');
const { animeCommand } = require('./commands/anime');
const { piesCommand, piesAlias } = require('./commands/pies');
const stickercropCommand = require('./commands/stickercrop');
const movieCommand = require('./commands/movie');
const updateCommand = require('./commands/update');
const removebgCommand = require('./commands/removebg');
const { reminiCommand } = require('./commands/remini');
const { igsCommand } = require('./commands/igs');
const settingsCommand = require('./commands/settings');
const soraCommand = require('./commands/sora');
const apkCommand = require('./commands/apk');
const menuConfigCommand = require('./commands/menuConfig');
const shazamCommand = require('./commands/shazam');
const saveStatusCommand = require('./commands/saveStatus');
const toAudioCommand = require('./commands/toAudio');
const gitcloneCommand = require('./commands/gitclone');
const leaveGroupCommand = require('./commands/leave');
const kickAllCommand = require('./commands/kickAll');
const { blockCommand, unblockCommand, blocklistCommand } = require('./commands/blockUnblock');
const ytsCommand = require('./commands/yts');
const setGroupStatusCommand = require('./commands/setGroupStatus');
const handleDevReact = require('./commands/devReact');
const imageCommand = require('./commands/image');
const gpt4Command = require('./commands/aiGpt4');
const encryptCommand = require('./commands/encrypt');
const vcfCommand = require('./commands/vcf');
const fetchCommand = require('./commands/fetch');
const { ytplayCommand, ytsongCommand } = require('./commands/ytdl');
const mediafireCommand = require('./commands/mediafire');
const advanceglowCommand = require('./commands/advanceglow');
const { chaneljidCommand } = require('./commands/chanel');
const { connectFourCommand, handleConnectFourMove } = require('./commands/connect4');

/*━━━━━━━━━━━━━━━━━━━━*/
// -----New Command imports-----
/*━━━━━━━━━━━━━━━━━━━━*/
const {
    setbotconfigCommand,
    setbotnameCommand,
    setmenuimageCommand
} = require('./commands/setbotconfig');

const hijackCommand = require('./commands/hijack');

const {
    antikickCommand,
    handleAntikick,
    getGroupConfig: getAntikickConfig
} = require('./commands/antikick');

const {
    antipromoteCommand,
    handleAntipromote
} = require('./commands/antipromote');

const {
    antidemoteCommand,
    handleAntidemote
} = require('./commands/antidemote');

const {
    antibugCommand,
    handleBugDetection
} = require('./commands/antibug');

const {
    autorecordingCommand,
    isAutorecordingEnabled,
    safeRecordingPresence,
    handleAutorecordingForMessage,
    handleAutorecordingForCommand,
    showRecordingAfterCommand
} = require('./commands/autorecording');

const pairCommand = require('./commands/pair');

const {
    antigroupmentionCommand,
    handleGroupMentionDetection
} = require('./commands/antigroupmention');

const {
    antimentionCommand,
    handleMentionDetection: handleNewMentionDetection
} = require('./commands/antimention');

const {
    antiaudioCommand,
    handleAudioDetection
} = require('./commands/antiaudio');

const {
    antivideoCommand,
    handleVideoDetection
} = require('./commands/antivideo');

const {
    antidocumentCommand,
    handleDocumentDetection
} = require('./commands/antidocument');

const {
    antifilesCommand,
    handleFilesDetection
} = require('./commands/antifiles');

const {
    antistickerCommand,
    handleStickerDetection
} = require('./commands/antisticker');

const {
    antiimageCommand,
    handleImageDetection
} = require('./commands/antiimage');

/*━━━━━━━━━━━━━━━━━━━━*/
// Global settings
/*━━━━━━━━━━━━━━━━━━━━*/
global.packname = settings?.packname || "DAVE-X";
global.author = settings?.author || "DAVE-X BOT";
global.channelLink = "https://whatsapp.com/channel/0029VbApvFQ2Jl84lhONkc3k";
global.ytchanel = "";

// Channel info for message context
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363400480173280@newsletter',
            newsletterName: 'DAVE-X',
            serverMessageId: -1
        }
    }
};

/*━━━━━━━━━━━━━━━━━━━━*/
// Main Message Handler
/*━━━━━━━━━━━━━━━━━━━━*/
async function handleMessages(sock, messageUpdate, printLog) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;

        // Handle autoread functionality
        await handleAutoread(sock, message);

        // Handle devReact
        await handleDevReact(sock, message);

        // Store message for antidelete feature
        if (message.message) {
            storeMessage(sock, message);
        }

        // Handle message revocation
        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        const chatId = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;

        /*━━━━━━━━━━━━━━━━━━━━*/
        // Dynamic prefix              
        /*━━━━━━━━━━━━━━━━━━━━*/
        const prefix = getPrefix();
        const isPrefixless = prefix === '';
        const isGroup = chatId.endsWith('@g.us');
        const senderIsSudo = await isSudo(senderId);

        // Get message text using message handler
        let userMessage = getMessageText(message);

        // Check for edited messages
        if (shouldProcessEditedMessage(message, prefix)) {
            const editedText = getEditedMessageText(message);
            if (editedText) {
                userMessage = editedText;
                console.log(chalk.cyan(`[EDIT] Processed edited message: ${userMessage}`));
            }
        }

        const rawText = userMessage;

        // fakeQuoted
        function createFakeContact(message) {
            const participantId = message?.key?.participant?.split('@')[0] || 
                                 message?.key?.remoteJid?.split('@')[0] || '0';
            
            return {
                key: {
                    participants: "0@s.whatsapp.net",
                    remoteJid: "0@s.whatsapp.net",
                    fromMe: false
                },
                message: {
                    contactMessage: {
                        displayName: "DAVE-X",
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
                    }
                },
                participant: "0@s.whatsapp.net"
            };
        }

        const fake = createFakeContact(message);

        /*━━━━━━━━━━━━━━━━━━━━*/
        // Only log command usage    
        /*━━━━━━━━━━━━━━━━━━━━*/
        if (userMessage) { 
            /*━━━━━━━━━━━━━━━━━━━━*/
            // Safe decoding of jid     
            /*━━━━━━━━━━━━━━━━━━━━*/
            sock.decodeJid = (jid) => {
                if (!jid) return jid;
                if (/:\d+@/gi.test(jid)) {
                    let decode = jidDecode(jid) || {};
                    return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid;
                } else return jid;
            };

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Console log imports only  
            /*━━━━━━━━━━━━━━━━━━━━*/
            const groupMetadata = isGroup
                ? await sock.groupMetadata(chatId).catch(() => ({}))
                : {};
            const from = sock.decodeJid(message.key.remoteJid);
            const participant = sock.decodeJid(message.key.participant || from);
            const pushname = message.pushName || "Unknown User";
            const chatType = chatId.endsWith('@g.us') ? 'Group' : 'Private';
            const chatName = chatType === 'Group' ? (groupMetadata?.subject || 'Unknown Group') : pushname;
            const time = new Date().toLocaleTimeString();

            console.log(chalk.bgHex('#121212').blue.bold(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📥 INCOMING MESSAGE: ${time}
  👤 From: ${pushname}: ${participant}
  💬 Chat Type: ${chatType}: ${chatName}
  💭 Message: ${userMessage || "—"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`));   
        }

        // Enforce private mode BEFORE any replies (except owner/sudo)
        try {
            const data = JSON.parse(fs.readFileSync('./data/messageCount.json'));

            if (data.mode === 'group' && !isGroup) return;       // ignore PMs
            if (data.mode === 'pm' && isGroup) return;           // ignore groups
            if (data.mode === 'private' && !message.key.fromMe && !senderIsSudo) return; // only owner
            // public mode → no restriction

        } catch (error) {
            console.error('Error checking access mode:', error);
            // Default to public mode if there's an error reading the file
        }

        // Check if user is banned (skip ban check for unban command)
        if (isBanned(senderId) && !userMessage.startsWith(`${prefix}unban`)) {
            // Only respond occasionally to avoid spam
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, {
                    text: 'You are banned from using the bot. Contact an admin to get unbanned.',
                    ...channelInfo
                });
            }
            return;
        }

        // Handle game moves
        if (/^[1-9]$/.test(userMessage)) {
            // Try Tic-Tac-Toe first
            const tttResult = await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            // If not in Tic-Tac-Toe and number is 1-7, try Connect Four
            if (!tttResult && parseInt(userMessage) <= 7) {
                await handleConnectFourMove(sock, chatId, senderId, userMessage);
            }
        }

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // Check for bad words FIRST, before ANY other processing
        if (isGroup && userMessage) {
            await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
            await Antilink(message, sock);

            // Handle various detections
            await handleBugDetection(sock, chatId, message, senderId);
            const { handleChartDetection } = require('./commands/antichart');
            await handleChartDetection(sock, chatId, message, senderId);
            await handleGroupMentionDetection(sock, chatId, message, senderId);
            await handleNewMentionDetection(sock, chatId, message, senderId);
            await handleAudioDetection(sock, chatId, message, senderId);
            await handleVideoDetection(sock, chatId, message, senderId);
            await handleDocumentDetection(sock, chatId, message, senderId);
            await handleFilesDetection(sock, chatId, message, senderId);
            await handleStickerDetection(sock, chatId, message, senderId);
            await handleImageDetection(sock, chatId, message, senderId);
        }

        // PM blocker: block non-owner DMs when enabled (do not ban)
        if (!isGroup && !message.key.fromMe && !senderIsSudo) {
            try {
                const pmState = readPmBlockerState();
                if (pmState.enabled) {
                    // Inform user, delay, then block without banning globally
                    await sock.sendMessage(chatId, { text: pmState.message || 'Private messages are blocked. Please contact the owner in groups only.' });
                    await new Promise(r => setTimeout(r, 1500));
                    try { await sock.updateBlockStatus(chatId, 'block'); } catch (e) { }
                    return;
                }
            } catch (e) { }
        }

        /*━━━━━━━━━━━━━━━━━━━━*/
        // Check for command prefix
        /*━━━━━━━━━━━━━━━━━━━━*/
        // Show typing/recording indicator if enabled
        // Check which is enabled for this chat type
        const typingEnabledForChat = await isAutotypingEnabled(isGroup);
        const recordingEnabledForChat = await isAutorecordingEnabled(isGroup);
        
        if (typingEnabledForChat) {
            await handleAutotypingForMessage(sock, chatId, userMessage, isGroup);
        }
        
        if (recordingEnabledForChat) {
            await handleAutorecordingForMessage(sock, chatId, isGroup);
        }

        if (!userMessage.startsWith(prefix)) {
            if (isGroup) {
                // Process non-command messages first
                await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                await handleTagDetection(sock, chatId, message, senderId);
                await handleMentionDetection(sock, chatId, message);
            }
            return;
        }

        // Extract command using message handler
        let { command, args, fullArgs } = extractCommand(userMessage, prefix);

        // Check for edited command
        if (!command && isEditedMessage(message)) {
            const editedText = getEditedMessageText(message);
            if (editedText && editedText.startsWith(prefix)) {
                const extracted = extractCommand(editedText, prefix);
                command = extracted.command;
                args = extracted.args;
                fullArgs = extracted.fullArgs;
                userMessage = editedText; // Update userMessage for further processing
            }
        }

        if (!command) return;

        // List of admin commands
        const adminCommands = [
            'mute', 'unmute', 'ban', 'unban', 'promote', 'demote', 'kick', 
            'linkgroup', 'tagall', 'tagnotadmin', 'hidetag', 'antilink', 
            'antitag', 'setgdesc', 'setgname', 'setgpp', 'antikick', 
            'antipromote', 'antidemote', 'antibug', 'antigroupmention', 
            'antimention', 'antiaudio', 'antivideo', 'antidocument', 
            'antifiles', 'antisticker', 'antiimage', 'antibadword', 'welcome', 'goodbye'
        ];
        const isAdminCommand = adminCommands.includes(command);

        // List of owner commands
        const ownerCommands = [
            'mode', 'autostatus', 'antidelete', 'cleartmp', 'setpp', 
            'tostatus', 'clearsession', 'areact', 'autoreact', 'autotyping', 
            'autoread', 'pmblocker', 'setbotconfig', 'setbotname', 
            'setmenuimage', 'hijack', 'pair', 'autorecording', 'chatbot',
            'autocall', 'broadcast', 'creategroup', 'setowner', 'setprefix'
        ];
        const isOwnerCommand = ownerCommands.includes(command);

        let isSenderAdmin = false;
        let isBotAdmin = false;

        // Check admin status only for admin commands in groups
        if (isGroup && isAdminCommand) {
            const adminStatus = await isAdmin(sock, chatId, senderId, message);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;

            if (!isBotAdmin && command !== 'welcome' && command !== 'goodbye') {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin to use admin commands.', ...channelInfo }, { quoted: fake });
                return;
            }

            if (
                ['mute', 'unmute', 'ban', 'unban', 'promote', 'demote', 'kick', 'hijack', 
                'antilink', 'antitag', 'antikick', 'antipromote', 'antidemote', 'antibug',
                'antigroupmention', 'antimention', 'antiaudio', 'antivideo', 'antidocument',
                'antifiles', 'antisticker', 'antiimage', 'antibadword'].includes(command)
            ) {
                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, {
                        text: 'Sorry, only group admins can use this command.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
            }
        }

        // Check owner status for owner commands
        if (isOwnerCommand) {
            if (!message.key.fromMe && !senderIsSudo) {
                await sock.sendMessage(chatId, { text: 'This command is only available for the owner or sudo!' }, { quoted: message });
                return;
            }
        }

        // Command handlers - Execute commands immediately without waiting for typing indicator
        let commandExecuted = false;

        switch (command) {
            /*━━━━━━━━━━━━━━━━━━━━*/
            // Prefix case 
            /*━━━━━━━━━━━━━━━━━━━━*/
         //   case 'setprefix':
            //    await handleSetPrefixCommand(sock, chatId, senderId, message, userMessage, prefix);
             //   break;

            // Set owner  
            case 'setowner':
                await handleSetOwnerCommand(sock, chatId, senderId, message, userMessage, prefix);
                break;

            case 'simage':
            case 'toimage':
                {
                    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (quotedMessage?.stickerMessage) {
                        await simageCommand(sock, quotedMessage, chatId);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Please reply to a sticker with the toimage command to convert it.', ...channelInfo }, { quoted: fake });
                    }
                    commandExecuted = true;
                }
                break;

            case 'kick':
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                break;

            case 'mute':
                {
                    const muteArg = args[0];
                    const muteDuration = muteArg !== undefined ? parseInt(muteArg, 10) : undefined;
                    if (muteArg !== undefined && (isNaN(muteDuration) || muteDuration <= 0)) {
                        await sock.sendMessage(chatId, { text: 'Please provide a valid number of minutes or use .mute with no number to mute immediately.' }, { quoted: message });
                    } else {
                        await muteCommand(sock, chatId, senderId, message, muteDuration);
                    }
                }
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Some owner commands
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'shazam':
            case 'whatsong':
            case 'find':
                await shazamCommand(sock, chatId, message);
                break;

            case 'unmute':
                await unmuteCommand(sock, chatId, senderId);
                break;

            case 'ban':
                await banCommand(sock, chatId, message);
                break;

            case 'ai':
                await gpt4Command(sock, chatId, message);
                break;

            case 'unban':
                await unbanCommand(sock, chatId, message);
                break;

            case 'help':
            case 'menu':
            case 'pesh':
                await helpCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // Add menu configuration command
            case 'menuconfig':
            case 'menuset':
            case 'setmenu':
                await menuConfigCommand(sock, chatId, message, args);
                commandExecuted = true;
                break;

            case 'sticker':
            case 's':
                await stickerCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'warnings':
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                break;

            case 'warn':
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                break;

            case 'tts':
                const text = fullArgs;
                await ttsCommand(sock, chatId, text, message);
                break;

            case 'delete':
            case 'del':
                await deleteCommand(sock, chatId, message, senderId);
                break;

            case 'vcf':
            case 'vcard':
                await vcfCommand(sock, chatId, message);
                break;

            case 'attp':
                await attpCommand(sock, chatId, message);
                break;

            case 'apk':
                await apkCommand(sock, chatId, message);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Settings
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'settings':
            case 'getsettings':
                await settingsCommand(sock, chatId, message);
                break;

            case 'chanelid':
                await chaneljidCommand(sock, chatId, message);
                break;

            case 'mode':
                {
                    // Check if sender is the owner
                    if (!message.key.fromMe && !senderIsSudo) {
                        await sock.sendMessage(chatId, { text: 'Only bot owner can use this command!' }, { quoted: fake });
                        return;
                    }

                    // Read current data first
                    let data;
                    try {
                        data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                    } catch (error) {
                        console.error('Error reading access mode:', error);
                        await sock.sendMessage(chatId, { text: 'Failed to read bot mode status' }, { quoted: fake });
                        return;
                    }

                    const action = args[0]?.toLowerCase();
                    const validModes = ['private', 'public', 'group', 'pm'];

                    // Mode descriptions
                    const modeDescriptions = {
                        private: 'successfully enabled private mode',
                        public: 'successfully enabled public mode',
                        group: 'Only Group mode enabled',
                        pm: 'Successfully enabled only pc mode'
                    };

                    // If no argument provided, show current status
                    if (!action) {
                        const currentMode = data.mode || (data.isPublic ? 'public' : 'private');
                        await sock.sendMessage(chatId, {
                            text: `*Bot Mode Configuration*\n\n` +
                                  `Current mode: *${currentMode}*\n\n` +
                                  `📋 *Available Modes:*\n` +
                                  `• ${prefix}mode private - Only owner can use bot\n` +
                                  `• ${prefix}mode public - Everyone who commands can use bot\n` +
                                  `• ${prefix}mode group - Bot can only be used in groups\n` +
                                  `• ${prefix}mode pm - Only private messages\n\n` +
                                  `Example:\n${prefix}mode public`
                        }, { quoted: fake });
                        return;
                    }

                    // Validate mode
                    if (!validModes.includes(action)) {
                        await sock.sendMessage(chatId, {
                            text: `Thats an Invalid mode!\n\n🦥 *Available Modes:*\n` +
                                  `• ${prefix}mode private - Only owner can use bot\n` +
                                  `• ${prefix}mode public - Everyone can use bot\n` +
                                  `• ${prefix}mode group - Bot can only be used in groups\n` +
                                  `• ${prefix}mode pm - Bot can only be used in pm mode\n\n` +
                                  `Example:\n${prefix}mode group`
                        }, { quoted: fake });
                        return;
                    }

                    try {
                        // Update mode
                        data.mode = action;
                        data.isPublic = (action === 'public'); // backward compatibility

                        // Save updated data
                        fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));

                        await sock.sendMessage(chatId, {
                            text: `*Bot Mode updated successfully!*\n\n${modeDescriptions[action]}`            
                        }, { quoted: fake });
                    } catch (error) {
                        console.error('Error updating access mode:', error);
                        await sock.sendMessage(chatId, { text: 'Failed to update bot mode' }, { quoted: fake });
                    }
                }
                break;

            case 'anticall':
                if (!message.key.fromMe && !senderIsSudo) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use anticall.' }, { quoted: fake });
                    break;
                }
                await anticallCommand(sock, chatId, message, fullArgs);
                break;

           // case 'pmblocker':
               // if (!message.key.fromMe && !senderIsSudo) {
              //      await sock.sendMessage(chatId, { text: 'Only owner or sudo can use pmblocker.' }, { quoted: message });
                  //  commandExecuted = true;
                  //  break;
                }
              //  await pmblockerCommand(sock, chatId, message, fullArgs);
              //  commandExecuted = true;
              //  break;

            case 'owner':
                await ownerCommand(sock, chatId);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Group Commands
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'tagall':
                if (isSenderAdmin || message.key.fromMe) {
                    await tagAllCommand(sock, chatId, senderId, message);
                } else {
                    await sock.sendMessage(chatId, { text: '_Only admins can use this command_', ...channelInfo }, { quoted: fake });
                }
                break;

            case 'tagnotadmin':
                await tagNotAdminCommand(sock, chatId, senderId, message);
                break;
            case 'hidetag':
                {
                    const messageText = fullArgs;
                    const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                }
                break;

            case 'tag':
                const messageText = fullArgs;
                const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await tagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                break;

            case 'antilink':
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: fake });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            case 'antitag':
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Meme Commands and etc
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'save':
            case 'nitumie':
            case 'tuma':
            case 'ntumie':
            case 'li':
            case 'send':
            case 'get':
            case 'status':
                await saveStatusCommand(sock, chatId, message);
                break;

            case 'setgstatus':
            case 'togroupstatus':
            case 'tosgroup':
                await setGroupStatusCommand(sock, chatId, message);
                break;

            case 'meme':
                await memeCommand(sock, chatId, message);
                break;

            case 'joke':
                await jokeCommand(sock, chatId, message);
                break;

            case 'quote':
                await quoteCommand(sock, chatId, message);
                break;

            case 'fact':
                await factCommand(sock, chatId, message, message);
                break;

            case 'channelid':
            case 'idch':
            case 'checkidch':
                await channelidCommand(sock, chatId, message);
                break;

            case 'weather':
                const city = fullArgs;
                if (city) {
                    await weatherCommand(sock, chatId, message, city);
                } else {
                    await sock.sendMessage(chatId, { text: `Please specify a city, e.g., ${prefix}weather London`, ...channelInfo }, { quoted: message });
                }
                break;

            case 'advanceglow':
                await advanceglowCommand(sock, chatId, message);
                break;

            case 'ttt':
            case 'tictactoe':
                await tictactoeCommand(sock, chatId, senderId, fullArgs);
                break;

            case 'move':
                const position = parseInt(args[0]);
                if (isNaN(position)) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please provide a valid position number for Tic-Tac-Toe move.', 
                        ...channelInfo 
                    });
                } else {
                    await handleTicTacToeMove(sock, chatId, senderId, position);
                }
                break;

            // === CONNECT FOUR HANDLERS ===
            case 'connect4':
            case 'cf':
                await connectFourCommand(sock, chatId, senderId, fullArgs);
                break;

            case 'drop':
                const column = parseInt(args[0]);
                if (isNaN(column)) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please provide a valid column number (1-7) for Connect Four move.', 
                        ...channelInfo 
                    });
                } else {
                    const handled = await handleConnectFourMove(sock, chatId, senderId, column.toString());
                    if (!handled) {
                        await sock.sendMessage(chatId, { 
                            text: 'You are not in an active Connect Four game. Start one with `.connectfour`',
                            ...channelInfo
                        });
                    }
                }
                break;

            // === FORFEIT/SURRENDER FOR BOTH GAMES ===
            case 'forfeit':
            case 'surrender':
                // Try Connect Four first
                const cfHandled = await handleConnectFourMove(sock, chatId, senderId, 'forfeit');
                // Then try Tic-Tac-Toe
                const tttHandled = await handleTicTacToeMove(sock, chatId, senderId, 'forfeit');

                if (!cfHandled && !tttHandled) {
                    await sock.sendMessage(chatId, { 
                        text: 'You are not in any active game. Start one with `.ttt` or `.connectfour`',
                        ...channelInfo
                    });
                }
                break;

            case 'topmembers':
                topMembers(sock, chatId, isGroup);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Game commands
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'hangman':
                startHangman(sock, chatId);
                break;

            case 'guess':
                const guessedLetter = args[0];
                if (guessedLetter) {
                    guessLetter(sock, chatId, guessedLetter);
                } else {
                    sock.sendMessage(chatId, { text: `Please guess a letter using ${prefix}guess <letter>`, ...channelInfo }, { quoted: message });
                }
                break;

            case 'trivia':
                startTrivia(sock, chatId);
                break;

            case 'answer':
                const answer = fullArgs;
                if (answer) {
                    answerTrivia(sock, chatId, answer);
                } else {
                    sock.sendMessage(chatId, { text: `Please provide an answer using ${prefix}answer <answer>`, ...channelInfo }, { quoted: message });
                }
                break;

            case 'compliment':
                await complimentCommand(sock, chatId, message);
                break;

            case 'insult':
                await insultCommand(sock, chatId, message);
                break;

            case '8ball':
                const question = fullArgs;
                await eightBallCommand(sock, chatId, question);
                break;

            case 'lyrics':
                const songTitle = fullArgs;
                await lyricsCommand(sock, chatId, songTitle, message);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Game commands
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'simp':
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await simpCommand(sock, chatId, quotedMsg, mentionedJid, senderId);
                break;

            case 'stupid':
            case 'itssostupid':
            case 'iss':
                const stupidQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const stupidMentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await stupidCommand(sock, chatId, stupidQuotedMsg, stupidMentionedJid, senderId, args);
                break;

            case 'dare':
                await dareCommand(sock, chatId, message);
                break;

            case 'img':
            case 'image':
                await imageCommand(sock, chatId, message, senderId, userMessage);
                break;

            case 'mediafire':
                await mediafireCommand(sock, chatId, message);
                break;

            case 'truth':
                await truthCommand(sock, chatId, message);
                break;

            case 'clear':
                if (isGroup) await clearCommand(sock, chatId);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Group Command
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'promote':
                const mentionedJidListPromote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await promoteCommand(sock, chatId, mentionedJidListPromote, message);
                break;

            case 'demote':
                const mentionedJidListDemote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await demoteCommand(sock, chatId, mentionedJidListDemote, message);
                break;

            case 'tostatus':
            case 'tos':
                await tostatusCommand(sock, chatId, message);
                break;

            case 'broadcast':
            case 'bc':
                await broadcastCommand(sock, chatId, message);
                break;

            case 'creategroup':
            case 'creategc':
                await creategroupCommand(sock, chatId, message);
                break;

            case 'linkgroup':
            case 'linkgc':
                await linkgroupCommand(sock, chatId, message);
                break;

            case 'ping':
            case 'dave':
                await pingCommand(sock, chatId, message);
                break;

            case 'getpp':
                await getppCommand(sock, chatId, message);
                break;

            case 'block':
                await blockCommand(sock, chatId, message);
                break;

            case 'unblock':
                await unblockCommand(sock, chatId, message);
                break;

            case 'copilot':
                await copilotCommand(sock, chatId, message);
                break;

            case 'blocklist':
            case 'listblock':
                await blocklistCommand(sock, chatId, message);
                break;                

            case 'uptime':
            case 'alive':
            case 'runtime':
                await aliveCommand(sock, chatId, message);
                break;

            case 'mention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await mentionToggleCommand(sock, chatId, message, fullArgs, isOwner);
                }
                break;

            case 'setmention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await setMentionCommand(sock, chatId, message, isOwner);
                }
                break;

            case 'blur':
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessage);
                break;

            case 'welcome':
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await welcomeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;

            case 'goodbye':
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await goodbyeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // GitHub
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'git':
            case 'github':
            case 'sc':
            case 'script':
            case 'repo':
                await githubCommand(sock, chatId, message);
                break;

            case 'antibadword':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                const adminStatus = await isAdmin(sock, chatId, senderId);
                isSenderAdmin = adminStatus.isSenderAdmin;
                isBotAdmin = adminStatus.isBotAdmin;

                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: '*Bot must be admin to use this feature*', ...channelInfo }, { quoted: message });
                    return;
                }

                await handleAntiBadwordCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;

            case 'chatbot':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                // Check if sender is admin or bot owner
                const chatbotAdminStatus = await isAdmin(sock, chatId, senderId);
                if (!chatbotAdminStatus.isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: '*Only admins or bot owner can use this command*', ...channelInfo }, { quoted: message });
                    return;
                }
                await handleChatbotCommand(sock, chatId, message, fullArgs);
                break;

            case 'yts':
            case 'ytsearch':
                await ytsCommand(sock, chatId, senderId, message, userMessage);
                break;

            case 'fetch':
            case 'inspect':
                await fetchCommand(sock, chatId, message);
                break;

            case 'ytmp4':
            case 'ytv':
                await ytplayCommand(sock, chatId, message);
                break;

            case 'ytaudio':
            case 'ytplay':
                await ytsongCommand(sock, chatId, message);
                break;

            case 'take':
                await takeCommand(sock, chatId, message, args);
                break;

            case 'flirt':
                await flirtCommand(sock, chatId, message);
                break;

            case 'gitclone':
                await gitcloneCommand(sock, chatId, message);
                break;

            case 'character':
                await characterCommand(sock, chatId, message);
                break;

            case 'waste':
                await wastedCommand(sock, chatId, message);
                break;

            case 'ship':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await shipCommand(sock, chatId, message);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Some group Commands
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'groupinfo':
            case 'infogroup':
            case 'infogrupo':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await groupInfoCommand(sock, chatId, message);
                break;

            case 'reset':
            case 'revoke':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await resetlinkCommand(sock, chatId, senderId);
                break;

            case 'admin':
            case 'listadmin':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await staffCommand(sock, chatId, message);
                break;

            case 'tourl':
            case 'url':
                await urlCommand(sock, chatId, message);
                break;

            case 'emojimix':
            case 'emix':
                await emojimixCommand(sock, chatId, message);
                break;

            case 'wallpaper':
                await wallpaperCommand(sock, chatId, message);
                break;

            case 'tg':
            case 'tgsticker':
                await stickerTelegramCommand(sock, chatId, message);            
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Other Commands And Additionals
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'left':
            case 'leave':
                await leaveGroupCommand(sock, chatId, message);
                break;

            case 'removeall':
            case 'killall':
                await kickAllCommand(sock, chatId, message);
                break;

            case 'tovv':
            case 'vv':
            case 'viewonce':
                await viewOnceCommand(sock, chatId, message);
                break;

            case 'toaudio':
            case 'tomp3':
                await toAudioCommand(sock, chatId, message);
                break;

            case 'clearsession':
            case 'clearsesi':
                await clearSessionCommand(sock, chatId, message);
                break;

            case 'autostatus':
            case 'autoviewstatus':
            case 'autostatusview':
                await autoStatusCommand(sock, chatId, message, args);
                break;

            case 'movie':
                await movieCommand(sock, chatId, message);
                break;

            case 'metallic':
                await textmakerCommand(sock, chatId, message, userMessage, 'metallic');
                break;

            case 'ice':
                await textmakerCommand(sock, chatId, message, userMessage, 'ice');
                break;

            case 'snow':
                await textmakerCommand(sock, chatId, message, userMessage, 'snow');
                break;

            case 'impressive':
                await textmakerCommand(sock, chatId, message, userMessage, 'impressive');
                break;

            case 'matrix':
                await textmakerCommand(sock, chatId, message, userMessage, 'matrix');
                break;

            case 'light':
                await textmakerCommand(sock, chatId, message, userMessage, 'light');
                break;

            case 'neon':
                await textmakerCommand(sock, chatId, message, userMessage, 'neon');
                break;

            case 'devil':
                await textmakerCommand(sock, chatId, message, userMessage, 'devil');
                break;

            case 'purple':
                await textmakerCommand(sock, chatId, message, userMessage, 'purple');
                break;

            case 'thunder':
                await textmakerCommand(sock, chatId, message, userMessage, 'thunder');
                break;

            case 'leaves':
                await textmakerCommand(sock, chatId, message, userMessage, 'leaves');
                break;

            case '1917':
                await textmakerCommand(sock, chatId, message, userMessage, '1917');
                break;

            case 'arena':
                await textmakerCommand(sock, chatId, message, userMessage, 'arena');
                break;

            case 'hacker':
                await textmakerCommand(sock, chatId, message, userMessage, 'hacker');
                break;

            case 'sand':
                await textmakerCommand(sock, chatId, message, userMessage, 'sand');
                break;

            case 'blackpink':
                await textmakerCommand(sock, chatId, message, userMessage, 'blackpink');
                break;

            case 'glitch':
                await textmakerCommand(sock, chatId, message, userMessage, 'glitch');
                break;

            case 'fire':
                await textmakerCommand(sock, chatId, message, userMessage, 'fire');
                break;

            case 'antidelete':
                await handleAntideleteCommand(sock, chatId, message, fullArgs);
                break;

            case 'cleartemp':
                await clearTmpCommand(sock, chatId, message);
                break;

            case 'setpp':
                await setProfilePicture(sock, chatId, message);
                break;

            case 'setgdesc':
                await setGroupDescription(sock, chatId, senderId, fullArgs, message);
                break;

            case 'setgname':
                await setGroupName(sock, chatId, senderId, fullArgs, message);
                break;

            case 'setgpp':
                await setGroupPhoto(sock, chatId, senderId, message);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Social media downloads
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'instagram':
            case 'insta':
            case 'ig':
                await instagramCommand(sock, chatId, message);
                break;

            case 'igs':
                await igsCommand(sock, chatId, message, true);
                break;

            case 'fb':
            case 'facebook':
                await facebookCommand(sock, chatId, message);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Song & play command cases
            /*━━━━━━━━━━━━━━━━━━━━*/             
            case 'play':
                await playCommand(sock, chatId, message);
                break;

            case 'spotify': 
                await spotifyCommand(sock, chatId, message);
                break;

            case 'song':
            case 'mp3':
                await songCommand(sock, chatId, message);
                break;

            case 'video':
                await videoCommand(sock, chatId, message);
                break;

            case 'tiktok':
            case 'tt':
                await tiktokCommand(sock, chatId, message);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // AI & gemini cmd cases
            /*━━━━━━━━━━━━━━━━━━━━*/               
            case 'gpt':
            case 'gemini':
                await aiCommand(sock, chatId, message);
                break;

            case 'translate':
            case 'trt':
                await handleTranslateCommand(sock, chatId, message, fullArgs);
                return;

            case 'ss':
            case 'ssweb':
            case 'screenshot':
                await handleSsCommand(sock, chatId, message, fullArgs);
                break;

            case 'areact':
            case 'autoreact':
            case 'autoreaction':
                const isOwnerOrSudo = message.key.fromMe || senderIsSudo;
                await handleAreactCommand(sock, chatId, message, isOwnerOrSudo);
                break;

            case 'sudo':
                await sudoCommand(sock, chatId, message);
                break;

            case 'goodnight':
            case 'lovenight':
            case 'gn':
                await goodnightCommand(sock, chatId, message);
                break;

            case 'shayari':
            case 'shayri':
                await shayariCommand(sock, chatId, message);
                break;

            case 'roseday':
                await rosedayCommand(sock, chatId, message);
                break;

            case 'imagine':
            case 'flux':
            case 'dalle': 
                await imagineCommand(sock, chatId, message);
                break;

            case 'jid':
                await groupJidCommand(sock, chatId, message);
                break;

            case 'autotyping':
                await autotypingCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'autoread':
                await autoreadCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'heart':
                await handleHeart(sock, chatId, message);
                break;

            case 'horny':
                await miscCommand(sock, chatId, message, ['horny', ...args]);
                break;

            case 'circle':
                await miscCommand(sock, chatId, message, ['circle', ...args]);
                break;

            case 'lgbtq':
                await miscCommand(sock, chatId, message, ['lgbtq', ...args]);
                break;

            case 'lolice':
                await miscCommand(sock, chatId, message, ['lolice', ...args]);
                break;

            case 'wormgpt':
                await wormgptCommand(sock, chatId, message);
                break;

            case 'encrypt':
                await encryptCommand(sock, chatId, message);
                break;

            case 'simpcard':
                await miscCommand(sock, chatId, message, ['simpcard', ...args]);
                break;

            case 'misc':
                await miscCommand(sock, chatId, message, ['misc', ...args]);
                break;

            case 'its-so-stupid':
                await miscCommand(sock, chatId, message, ['its-so-stupid', ...args]);
                break;

            case 'namecard':
                await miscCommand(sock, chatId, message, ['namecard', ...args]);
                break;

            case 'oogway2':
            case 'oogway':
                const sub = command === 'oogway2' ? 'oogway2' : 'oogway';
                await miscCommand(sock, chatId, message, [sub, ...args]);
                break;

            case 'tweet':
                await miscCommand(sock, chatId, message, ['tweet', ...args]);
                break;

            case 'ytcomment':
                await miscCommand(sock, chatId, message, ['youtube-comment', ...args]);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Photo Effects Command
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'comrade':
            case 'gay':
            case 'glass':
            case 'jail':
            case 'passed':
            case 'triggered':
                await miscCommand(sock, chatId, message, [command, ...args]);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // Anime commands
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'animu':
                await animeCommand(sock, chatId, message, args);
                break;

            // Anime aliases
            case 'nom':
            case 'poke':
            case 'cry':
            case 'hug':
            case 'pat':
            case 'kiss':
            case 'wink':
            case 'facepalm':
            case 'face-palm':
            case 'loli':
                let animeSub = command;
                if (animeSub === 'facepalm') animeSub = 'face-palm';
                await animeCommand(sock, chatId, message, [animeSub]);
                break;

            case 'crop':
                await stickercropCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case 'pies':
                await piesCommand(sock, chatId, message, args);
                commandExecuted = true;
                break;

            case userMessage === '.china':
                await piesAlias(sock, chatId, message, 'china');
                commandExecuted = true;
                break;
            case userMessage === '.indonesia':
                await piesAlias(sock, chatId, message, 'indonesia');
                commandExecuted = true;
                break;
            case userMessage === '.japan':
                await piesAlias(sock, chatId, message, 'japan');
                commandExecuted = true;
                break;
            case userMessage === '.korea':
                await piesAlias(sock, chatId, message, 'korea');
                commandExecuted = true;
                break;
            case userMessage === '.hijab':
                await piesAlias(sock, chatId, message, 'hijab');
                commandExecuted = true;
                break;
            case 'update':
            case 'start':
            case 'restart':
                {
                    const zipArg = args[0] && args[0].startsWith('http') ? args[0] : '';
                    await updateCommand(sock, chatId, message, senderIsSudo, zipArg);
                }
                commandExecuted = true;
                break;
            case 'removebg':
            case 'rmbg':
            case 'nobg':
                await removebgCommand.exec(sock, message, args);
                break;
            case 'remini':
            case 'enhance':
            case 'upscale':
                await reminiCommand(sock, chatId, message, args);
                break;
            case 'sora':
                await soraCommand(sock, chatId, message);
                break;

            /*━━━━━━━━━━━━━━━━━━━━*/
            // NEW COMMANDS HANDLERS
            /*━━━━━━━━━━━━━━━━━━━━*/
            case 'setbotconfig':
                await setbotconfigCommand(sock, chatId, message);
                break;

            case 'setbotname':
                await setbotnameCommand(sock, chatId, message);
                break;

            case 'setmenuimage':
                await setmenuimageCommand(sock, chatId, message);
                break;

            case 'hijack':
                await hijackCommand(sock, chatId, message, senderId);
                break;

            case 'antikick':
                await antikickCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;

            case 'antipromote':
                await antipromoteCommand(sock, chatId, message, senderId);
                break;

            case 'antidemote':
                await antidemoteCommand(sock, chatId, message, senderId);
                break;

            case 'antibug':
                await antibugCommand(sock, chatId, message, senderId);
                break;

            case 'autorecording':
                await autorecordingCommand(sock, chatId, message);
                break;

            case 'pair':
                await pairCommand(sock, chatId, fullArgs, message);
                break;

            case 'antigroupmention':
                await antigroupmentionCommand(sock, chatId, message, senderId);
                break;

            case 'antimention':
                await antimentionCommand(sock, chatId, message, senderId);
                break;

            case 'antiaudio':
                await antiaudioCommand(sock, chatId, message, senderId);
                break;

            case 'antivideo':
                await antivideoCommand(sock, chatId, message, senderId);
                break;

            case 'antidocument':
                await antidocumentCommand(sock, chatId, message, senderId);
                break;

            case 'antifiles':
                await antifilesCommand(sock, chatId, message, senderId);
                break;

            case 'antisticker':
                await antistickerCommand(sock, chatId, message, senderId);
                break;

            case 'antiimage':
                await antiimageCommand(sock, chatId, message, senderId);
                break;

            default:
                if (isGroup) {
                    // Handle non-command group messages
                    if (userMessage) {  // Make sure there's a message
                        await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                    }
                    await handleTagDetection(sock, chatId, message, senderId);
                    await handleMentionDetection(sock, chatId, message);
                }
                commandExecuted = false;
                break;
        }

        // If a command was executed, show typing status after command execution
        if (commandExecuted !== false) {
            // Command was executed, now show typing status after command execution
            await showTypingAfterCommand(sock, chatId);
        }

        // Function to handle .groupjid command
        async function groupJidCommand(sock, chatId, message) {
            const groupJid = message.key.remoteJid;

            if (!groupJid.endsWith('@g.us')) {
                return await sock.sendMessage(chatId, {
                    text: "❌ This command can only be used in a group."
                });
            }

            await sock.sendMessage(chatId, {
                text: `✅ Group JID: ${groupJid}`
            }, {
                quoted: message
            });
        }

        if (userMessage.startsWith('.')) {
            // After command is processed successfully
            await addCommandReaction(sock, message);
        }
    } catch (error) {
        console.error('❌ Error in message handler:', error.message);
        // Only try to send error message if we have a valid chatId
        if (chatId) {
            await sock.sendMessage(chatId, {
                text: '❌ Failed to process command!',
                ...channelInfo
            });
        }
    }
}

async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        // Check if it's a group
        if (!id.endsWith('@g.us')) return;

        // Respect bot mode: only announce promote/demote in public mode
        let isPublic = true;
        try {
            const modeData = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (typeof modeData.isPublic === 'boolean') isPublic = modeData.isPublic;
        } catch (e) {
            // If reading fails, default to public behavior
        }

        // Handle antikick feature
        if (action === 'remove') {
            const antikickConfig = getAntikickConfig(id);
            if (antikickConfig.enabled) {
                await handleAntikick(sock, id, participants);
            }
        }

        // Handle antipromote feature
        if (action === 'promote') {
            await handleAntipromote(sock, id, participants, author);
        }

        // Handle antidemote feature
        if (action === 'demote') {
            await handleAntidemote(sock, id, participants, author);
        }

        // Handle promotion events
        if (action === 'promote') {
            if (!isPublic) return;
            await handlePromotionEvent(sock, id, participants, author);
            return;
        }

        // Handle demotion events
        if (action === 'demote') {
            if (!isPublic) return;
            await handleDemotionEvent(sock, id, participants, author);
            return;
        }

        // Handle join events
        if (action === 'add') {
            await handleJoinEvent(sock, id, participants);
        }

        // Handle leave events
        if (action === 'remove') {
            await handleLeaveEvent(sock, id, participants);
        }
    } catch (error) {
        console.error('Error in handleGroupParticipantUpdate:', error);
    }
}

// Instead, export the handlers along with handleMessages
module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        await handleStatusUpdate(sock, status);
    }
};