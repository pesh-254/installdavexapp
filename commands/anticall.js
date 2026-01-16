const fs = require('fs');
const path = require('path');
const os = require("os");

const ANTICALL_PATH = './data/anticall.json';

// Create fake contact for enhanced replies
function createFakeContact(message) {
    const sender = message.key.participant || message.key.remoteJid;
    const number = sender.split('@')[0];
    
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "DAVE-MD"
        },
        message: {
            contactMessage: {
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;Bot;;;\nFN:VENOM-XMD\nitem1.TEL;waid=${number}:${number}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function readState() {
    try {
        if (!fs.existsSync(ANTICALL_PATH)) return { enabled: false };
        const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
        const data = JSON.parse(raw || '{}');
        return { enabled: !!data.enabled };
    } catch {
        return { enabled: false };
    }
}

function writeState(enabled) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
    } catch {}
}

async function anticallCommand(sock, chatId, message, args) {
    // Create fake contact for reply
    const fake = createFakeContact(message);
    
    const state = readState();
    const sub = (args || '').trim().toLowerCase();

    if (!sub || (sub !== 'on' && sub !== 'off' && sub !== 'status')) {
        const helpText = `*ANTICALL SETTINGS*\n\n` +
                        `• .anticall on     - Enable auto-block on incoming calls\n` +
                        `• .anticall off    - Disable anticall\n` +
                        `• .anticall status - Show current status`;
        
        await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
        return;
    }

    if (sub === 'status') {
        const statusText = `Anticall is currently *${state.enabled ? 'ACTIVE' : 'INACTIVE'}*.`;
        await sock.sendMessage(chatId, { text: statusText }, { quoted: fake });
        return;
    }

    const enable = sub === 'on';
    writeState(enable);
    
    const resultText = `Anticall has been *${enable ? 'ENABLED' : 'DISABLED'}*.`;
    await sock.sendMessage(chatId, { text: resultText }, { quoted: fake });
}

module.exports = { anticallCommand, readState };