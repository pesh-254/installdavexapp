const fs = require('fs');
const path = require('path');

const OWNER_FILE = path.join(__dirname, '..', 'data', 'owner.json');
const DEFAULT_OWNER_NAME = 'Not set';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(OWNER_FILE)) {
    fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: DEFAULT_OWNER_NAME }, null, 2));
}

function getOwnerName() {
    try {
        const data = JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8'));
        return data.ownerName || DEFAULT_OWNER_NAME;
    } catch (error) {
        console.error('Error reading owner file:', error);
        return DEFAULT_OWNER_NAME;
    }
}

function setOwnerName(newOwnerName) {
    try {
        if (!newOwnerName?.trim() || newOwnerName.trim().length > 20) return false;

        const trimmedName = newOwnerName.trim();
        fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: trimmedName }, null, 2));
        return true;
    } catch (error) {
        console.error('Error setting owner name:', error);
        return false;
    }
}

function resetOwnerName() {
    try {
        fs.writeFileSync(OWNER_FILE, JSON.stringify({ ownerName: DEFAULT_OWNER_NAME }, null, 2));
        return true;
    } catch (error) {
        console.error('Error resetting owner name:', error);
        return false;
    }
}

function validateOwnerName(name) {
    if (!name?.trim()) return { isValid: false, message: 'Owner name cannot be empty' };

    const trimmed = name.trim();
    if (trimmed.length > 20) return { isValid: false, message: 'Owner name must be 1-20 characters long' };

    const invalidChars = /[<>@#\$%\^\*\\\/]/;
    if (invalidChars.test(trimmed)) return { isValid: false, message: 'Owner name contains invalid characters' };

    return { isValid: true, message: 'Valid owner name' };
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

async function handleSetOwnerCommand(sock, chatId, senderId, message, userMessage, currentPrefix) {
    const fkontak = createFakeContact(message);
    const args = userMessage.split(' ').slice(1);
    const input = args.join(' ');

    if (!message.key.fromMe) {
        await sock.sendMessage(chatId, { 
            text: 'Access restricted'
        }, { quoted: fkontak });
        return;
    }

    if (!input) {
        const current = getOwnerName();
        const replyText = `Current: ${current}\n\nFormat: ${currentPrefix}setowner [name]\nExample: ${currentPrefix}setowner Admin\nRevert: ${currentPrefix}setowner revert`;
        
        await sock.sendMessage(chatId, { 
            text: replyText 
        }, { quoted: fkontak });
        return;
    }

    if (input.toLowerCase() === 'revert') {
        const success = resetOwnerName();
        const response = success ? 
            `Reset to: ${DEFAULT_OWNER_NAME}` : 
            'Reset failed';
        await sock.sendMessage(chatId, { text: response }, { quoted: fkontak });
        return;
    }

    const validation = validateOwnerName(input);
    if (!validation.isValid) {
        await sock.sendMessage(chatId, { 
            text: validation.message 
        }, { quoted: fkontak });
        return;
    }

    const success = setOwnerName(input);
    const response = success ? 
        `Set to: ${input.trim()}` : 
        'Update failed';

    await sock.sendMessage(chatId, { text: response }, { quoted: fkontak });
}

function getOwnerInfo() {
    const ownerName = getOwnerName();
    return {
        name: ownerName,
        formattedName: ownerName,
        isDefault: ownerName === DEFAULT_OWNER_NAME
    };
}

function isOwnerNameMatch(nameToCheck, caseSensitive = true) {
    const currentOwner = getOwnerName();
    return caseSensitive ? 
        currentOwner === nameToCheck : 
        currentOwner.toLowerCase() === nameToCheck.toLowerCase();
}

module.exports = {
    getOwnerName,
    setOwnerName,
    resetOwnerName,
    handleSetOwnerCommand,
    validateOwnerName,
    getOwnerInfo,
    isOwnerNameMatch,
    DEFAULT_OWNER_NAME
};