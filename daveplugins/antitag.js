import fs from 'fs';
import path from 'path';
import isAdmin from '../lib/isAdmin.js';

const DATA_DIR = path.resolve('./data');
const ANTITAG_FILE = path.join(DATA_DIR, 'antitag.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Load antitag settings
function loadSettings() {
    if (!fs.existsSync(ANTITAG_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(ANTITAG_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

// Save antitag settings
function saveSettings(settings) {
    fs.writeFileSync(ANTITAG_FILE, JSON.stringify(settings, null, 2));
}

export default {
    name: 'antitag',
    description: 'Automatically delete or warn users for tagging in group',
    adminOnly: true,

    async execute(msg, { sock, args }) {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            return sock.sendMessage(remoteJid, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const { isSenderAdmin } = await isAdmin(sock, remoteJid, sender);
        if (!isSenderAdmin) {
            return sock.sendMessage(remoteJid, { text: '❌ This command is for group admins only.' }, { quoted: msg });
        }

        const settings = loadSettings();
        const groupSettings = settings[remoteJid] || { mode: 'off', warnings: {} };

        const sub = args[0]?.toLowerCase();
        if (!sub || !['delete', 'warn', 'reset'].includes(sub)) {
            return sock.sendMessage(remoteJid, { text: '⚡ Usage:\n• antitag delete\n• antitag warn\n• antitag reset' }, { quoted: msg });
        }

        if (sub === 'delete') {
            groupSettings.mode = 'delete';
            groupSettings.warnings = {};
            settings[remoteJid] = groupSettings;
            saveSettings(settings);
            return sock.sendMessage(remoteJid, { text: '✅ Antitag is now in DELETE mode. Any tagged message will be deleted automatically.' }, { quoted: msg });
        }

        if (sub === 'warn') {
            groupSettings.mode = 'warn';
            groupSettings.warnings = {};
            settings[remoteJid] = groupSettings;
            saveSettings(settings);
            return sock.sendMessage(remoteJid, { text: '✅ Antitag is now in WARN mode. Any tagged message will be deleted and the user will be warned (kick after 5 warnings).' }, { quoted: msg });
        }

        if (sub === 'reset') {
            delete settings[remoteJid];
            saveSettings(settings);
            return sock.sendMessage(remoteJid, { text: '✅ Antitag settings reset for this group.' }, { quoted: msg });
        }
    },

    // This function must be called from your message handler
    async onMessage(msg, { sock }) {
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || !remoteJid.endsWith('@g.us')) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const { isSenderAdmin } = await isAdmin(sock, remoteJid, sender);
        
        // Don't act on admins tagging
        if (isSenderAdmin) return;

        const settings = loadSettings();
        const groupSettings = settings[remoteJid];
        if (!groupSettings || groupSettings.mode === 'off') return;

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const mentioned = contextInfo?.mentionedJid || [];

        // Check for plain text @ mentions
        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
        const textMentions = (messageText.match(/@[0-9]{5,}/g) || []).length;

        const totalMentions = mentioned.length + textMentions;

        if (totalMentions > 0) {
            const isFromMe = msg.key.fromMe;
            if (isFromMe) return; // Don't act on bot's own mentions

            // Delete message
            try { await sock.sendMessage(remoteJid, { delete: msg.key }); } catch { }

            if (groupSettings.mode === 'warn') {
                // Increment warnings
                if (!groupSettings.warnings) groupSettings.warnings = {};
                groupSettings.warnings[sender] = (groupSettings.warnings[sender] || 0) + 1;

                // Warn user
                await sock.sendMessage(remoteJid, {
                    text: `⚠️ @${sender.split('@')[0]} tagged someone! Warning ${groupSettings.warnings[sender]}/5`,
                    mentions: [sender]
                });

                // Kick if 5 warnings
                if (groupSettings.warnings[sender] >= 5) {
                    const { isBotAdmin } = await isAdmin(sock, remoteJid, sender);
                    if (!isBotAdmin) {
                        return sock.sendMessage(remoteJid, { text: '❌ Cannot kick user because bot is not an admin.' });
                    }
                    try {
                        // Use groupParticipantsUpdate which is the standard Baileys way for kicking
                        await sock.groupParticipantsUpdate(remoteJid, [sender], 'remove');
                        await sock.sendMessage(remoteJid, { text: `❌ @${sender.split('@')[0]} has been kicked for exceeding 5 tag warnings!`, mentions: [sender] });
                        delete groupSettings.warnings[sender];
                    } catch (err) {
                        await sock.sendMessage(remoteJid, { text: `❌ Failed to kick @${sender.split('@')[0]}: ${err.message}`, mentions: [sender] });
                    }
                }
            }

            // Save updated settings
            settings[remoteJid] = groupSettings;
            saveSettings(settings);
        }
    }
};
