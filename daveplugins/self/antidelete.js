import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { writeFile } from 'fs/promises';
import config from '../../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const messageStore = new Map();
const CONFIG_PATH = path.join(process.cwd(), 'data', 'antidelete.json');
const MESSAGES_STORE_PATH = path.join(process.cwd(), 'data', 'antidelete_messages.json');
const TEMP_MEDIA_DIR = path.join(process.cwd(), 'tmp');

if (!fs.existsSync(TEMP_MEDIA_DIR)) {
    fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
}

function loadAntideleteConfig() {
    try {
        let local = { enabled: false };
        if (fs.existsSync(CONFIG_PATH)) {
            local = JSON.parse(fs.readFileSync(CONFIG_PATH));
        }
        return { enabled: local.enabled || config.antiDelete };
    } catch {
        return { enabled: false };
    }
}

function saveAntideleteConfig(configData) {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2));
    } catch (err) {}
}

function saveStoredMessages() {
    try {
        const data = Object.fromEntries(messageStore);
        fs.writeFileSync(MESSAGES_STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {}
}

export default {
    name: 'antidelete',
    description: 'Configure anti-delete message tracking (silent mode)',
    aliases: ['antidel'],
    async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;

        if (!msg.key.fromMe) {
            return await sock.sendMessage(from, {
                text: '❌ This is a self mode command. Only accessible when using your own account.'
            }, { quoted: msg });
        }

        const configData = loadAntideleteConfig();
        const action = (args[0] || '').toLowerCase();

        if (action === 'on') {
            configData.enabled = true;
            saveAntideleteConfig(configData);
            await sock.sendMessage(from, { text: '✅ Antidelete enabled (Silent Mode).' });
        } else if (action === 'off') {
            configData.enabled = false;
            saveAntideleteConfig(configData);
            messageStore.clear();
            saveStoredMessages();
            await sock.sendMessage(from, { text: '❌ Antidelete disabled.' });
        } else {
            await sock.sendMessage(from, { 
                text: `🗑️ *ANTIDELETE*\nStatus: ${configData.enabled ? 'ON' : 'OFF'}\n\nUse: ${settings.prefix}antidelete on/off`
            });
        }
    }
};

export async function storeMessage(sock, message) {
    try {
        const configData = loadAntideleteConfig();
        if (!configData.enabled) return;

        if (!message.key?.id || message.key.remoteJid.endsWith('@newsletter')) return;

        const messageId = message.key.id;
        let content = '';
        let mediaType = '';
        let mediaPath = '';

        if (message.message?.conversation) content = message.message.conversation;
        else if (message.message?.extendedTextMessage?.text) content = message.message.extendedTextMessage.text;
        else if (message.message?.imageMessage) {
            mediaType = 'image';
            content = message.message.imageMessage.caption || '';
        } else if (message.message?.videoMessage) {
            mediaType = 'video';
            content = message.message.videoMessage.caption || '';
        } else if (message.message?.stickerMessage) mediaType = 'sticker';
        else if (message.message?.audioMessage) mediaType = 'audio';

        messageStore.set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender: message.key.participant || message.key.remoteJid,
            group: message.key.remoteJid.endsWith('@g.us') ? message.key.remoteJid : null,
            timestamp: new Date().toISOString()
        });
        saveStoredMessages();
    } catch (err) {}
}

export async function handleMessageRevocation(sock, revocationMessage) {
    try {
        const configData = loadAntideleteConfig();
        if (!configData.enabled) return;

        const messageId = revocationMessage.message?.protocolMessage?.key?.id;
        if (!messageId || revocationMessage.key?.fromMe) return;

        const original = messageStore.get(messageId);
        if (original) {
            const ownerNumber = config.ownerNumber.replace(/[^\d]/g, '') + '@s.whatsapp.net';
            const sender = original.sender;
            
            let text = `🗑️ *ANTIDELETE ALERT*\n\n` +
                       `*👤 Sender:* @${sender.split('@')[0]}\n` +
                       `*💬 Message:* ${original.content || '[Media/No Text]'}`;

            await sock.sendMessage(ownerNumber, { text, mentions: [sender] });
            
            messageStore.delete(messageId);
            saveStoredMessages();
        }
    } catch (err) {}
}
