const fs = require('fs');
const path = require('path');

// Path to store prefix settings
const PREFIX_FILE = path.join(__dirname, '..', 'data', 'prefix.json');

// Default prefix
const DEFAULT_PREFIX = '.';

// Special value for no prefix
const NO_PREFIX = 'none';

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize prefix file if it doesn't exist
if (!fs.existsSync(PREFIX_FILE)) {
    fs.writeFileSync(PREFIX_FILE, JSON.stringify({ prefix: DEFAULT_PREFIX }, null, 2));
}

function createFakeContact(message) {
    const phone = message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0];
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Dave-X;;;\nFN:DAVE-X\nTEL;waid=${phone}:${phone}\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function getPrefix() {
    try {
        const data = JSON.parse(fs.readFileSync(PREFIX_FILE, 'utf8'));
        return data.prefix === NO_PREFIX ? '' : (data.prefix || DEFAULT_PREFIX);
    } catch (error) {
        console.error('Error reading prefix file:', error);
        return DEFAULT_PREFIX;
    }
}

function getRawPrefix() {
    try {
        const data = JSON.parse(fs.readFileSync(PREFIX_FILE, 'utf8'));
        return data.prefix || DEFAULT_PREFIX;
    } catch (error) {
        console.error('Error reading prefix file:', error);
        return DEFAULT_PREFIX;
    }
}

function setPrefix(newPrefix) {
    try {
        if (newPrefix === '') {
            const data = { prefix: NO_PREFIX };
            fs.writeFileSync(PREFIX_FILE, JSON.stringify(data, null, 2));
            return true;
        } else if (newPrefix && newPrefix.length <= 3) {
            const data = { prefix: newPrefix };
            fs.writeFileSync(PREFIX_FILE, JSON.stringify(data, null, 2));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error setting prefix:', error);
        return false;
    }
}

function resetPrefix() {
    try {
        const data = { prefix: DEFAULT_PREFIX };
        fs.writeFileSync(PREFIX_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error resetting prefix:', error);
        return false;
    }
}

function isPrefixless() {
    return getRawPrefix() === NO_PREFIX;
}

async function handleSetPrefixCommand(sock, chatId, senderId, message, userMessage, currentPrefix) {
    const fkontak = createFakeContact(message);
    const args = userMessage.split(' ').slice(1);
    const newPrefix = args[0];

    // Only bot owner can change prefix
    if (!message.key.fromMe) {
        await sock.sendMessage(chatId, { 
            text: 'Owner only command.'
        }, { quoted: fkontak });
        return;
    }

    if (!newPrefix) {
        const current = getRawPrefix();
        const displayPrefix = current === NO_PREFIX ? 'None' : current;
        await sock.sendMessage(chatId, { 
            text: `Current: ${displayPrefix}\n\nUsage: ${current === NO_PREFIX ? 'setprefix' : current + 'setprefix'} <new|none>\nExample: ${current === NO_PREFIX ? 'setprefix' : current + 'setprefix'} !\nReset: ${current === NO_PREFIX ? 'setprefix' : current + 'setprefix'} reset`
        }, { quoted: fkontak });
        return;
    }

    if (newPrefix === 'reset') {
        const success = resetPrefix();
        if (success) {
            const defaultPrefix = getPrefix();
            await sock.sendMessage(chatId, { 
                text: `Reset to: ${defaultPrefix}`
            }, { quoted: fkontak });
        } else {
            await sock.sendMessage(chatId, { 
                text: 'Reset failed.'
            }, { quoted: fkontak });
        }
        return;
    }

    if (newPrefix.toLowerCase() === NO_PREFIX) {
        const success = setPrefix('');
        if (success) {
            await sock.sendMessage(chatId, { 
                text: 'Prefixless mode set.'
            }, { quoted: fkontak });
        } else {
            await sock.sendMessage(chatId, { 
                text: 'Failed to set prefixless.'
            }, { quoted: fkontak });
        }
        return;
    }

    if (newPrefix.length > 3) {
        await sock.sendMessage(chatId, { 
            text: 'Prefix: 1-3 chars. Use "none" for prefixless.'
        }, { quoted: fkontak });
        return;
    }

    const success = setPrefix(newPrefix);
    if (success) {
        await sock.sendMessage(chatId, { 
            text: `Prefix set: ${newPrefix}`
        }, { quoted: fkontak });
    } else {
        await sock.sendMessage(chatId, { 
            text: 'Failed to set prefix.'
        }, { quoted: fkontak });
    }
}

module.exports = {
    getPrefix,
    getRawPrefix,
    setPrefix,
    resetPrefix,
    isPrefixless,
    handleSetPrefixCommand,
    NO_PREFIX
};