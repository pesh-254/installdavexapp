const fs = require('fs');
const path = require('path');

// Path to store the configuration
const configPath = path.join(__dirname, '..', 'data', 'autoread.json');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// Initialize configuration file if it doesn't exist
function initConfig() {
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({ mode: 'off' }, null, 2));
    }
    return JSON.parse(fs.readFileSync(configPath));
}

// Toggle autoread feature
async function autoreadCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        
        // Check if sender is the owner (bot itself)
        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, {
                text: 'This command is only available for the owner!'
            }, { quoted: fake });
            return;
        }

        // Get command arguments
        const args = message.message?.conversation?.trim().split(' ').slice(1) || 
                    message.message?.extendedTextMessage?.text?.trim().split(' ').slice(1) || 
                    [];

        // Initialize or read config
        const config = initConfig();

        // Handle different command options
        if (args.length === 0) {
            // Show usage when no arguments provided
        const usageText = `AUTO-READ STATUS

Current Mode: ${config.mode}

COMMANDS:
autoread - usage guide
autoread status - Check current status
autoread all - Enable for all chats and groups
autoread chat - Enable for chats only
autoread group - Enable for groups only
autoread off - Disable autoread
`;

            await sock.sendMessage(chatId, {
                text: usageText
            }, { quoted: fake });
            return;
        }

        const action = args[0].toLowerCase();

        // Handle specific commands
        switch (action) {
            case 'all':
            case 'both':
                config.mode = 'all';
                break;

            case 'chat':
            case 'chats':
                config.mode = 'chats';
                break;

            case 'group':
            case 'groups':
                config.mode = 'groups';
                break;

            case 'off':
                config.mode = 'off';
                break;

            case 'status':
                // Show current status
                await sock.sendMessage(chatId, {
                    text: `AutoRead Status\n\nCurrent Mode: ${config.mode}`
                }, { quoted: fake });
                return;

            default:
                await sock.sendMessage(chatId, {
                    text: 'Invalid option! Use: .autoread to see all available options'
                }, { quoted: fake });
                return;
        }

        // Save updated configuration
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        // Send confirmation message
        await sock.sendMessage(chatId, {
            text: `Auto-read mode set to: ${config.mode}`
        }, { quoted: fake });

    } catch (error) {
        console.error('Error in autoread command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, {
            text: 'Error processing command!'
        }, { quoted: fake });
    }
}

// Function to get current autoread mode
function getAutoreadMode() {
    try {
        const config = initConfig();
        return config.mode;
    } catch (error) {
        console.error('Error checking autoread mode:', error);
        return 'off';
    }
}

// Function to check if bot is mentioned in a message
function isBotMentionedInMessage(message, botNumber) {
    if (!message.message) return false;

    const messageTypes = [
        'extendedTextMessage', 'imageMessage', 'videoMessage', 'stickerMessage',
        'documentMessage', 'audioMessage', 'contactMessage', 'locationMessage'
    ];

    for (const type of messageTypes) {
        if (message.message[type]?.contextInfo?.mentionedJid) {
            const mentionedJid = message.message[type].contextInfo.mentionedJid;
            if (mentionedJid.some(jid => jid === botNumber)) {
                return true;
            }
        }
    }

    const textContent = 
        message.message.conversation || 
        message.message.extendedTextMessage?.text ||
        message.message.imageMessage?.caption ||
        message.message.videoMessage?.caption || '';

    if (textContent) {
        const botUsername = botNumber.split('@')[0];
        if (textContent.includes(`@${botUsername}`)) {
            return true;
        }

        const botNames = [global.botname?.toLowerCase(), 'bot', 'Dave Md', 'Dave X'];
        const words = textContent.toLowerCase().split(/\s+/);
        if (botNames.some(name => words.includes(name))) {
            return true;
        }
    }

    return false;
}

// Function to handle autoread functionality
async function handleAutoread(sock, message) {
    const mode = getAutoreadMode();
    if (mode === 'off') return false;

    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isBotMentioned = isBotMentionedInMessage(message, botNumber);

    // Skip marking as read if bot is mentioned
    if (isBotMentioned) return false;

    const isGroup = message.key.remoteJid.endsWith('@g.us');

    if (mode === 'all' || 
        (mode === 'chats' && !isGroup) || 
        (mode === 'groups' && isGroup)) {
        const key = { remoteJid: message.key.remoteJid, id: message.key.id, participant: message.key.participant };
        await sock.readMessages([key]);
        return true;
    }

    return false;
}

module.exports = {
    autoreadCommand,
    getAutoreadMode,
    isBotMentionedInMessage,
    handleAutoread
};