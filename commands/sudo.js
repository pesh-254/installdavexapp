const settings = require('../settings');
const { addSudo, removeSudo, getSudoList } = require('../lib/index');

/**
 * Extracts a mentioned JID or number from a message.
 * @param {object} message - WhatsApp message object
 * @returns {string|null} JID string or null if not found
 */
function extractMentionedJid(message) {
    try {
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length > 0) return mentioned[0];

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const match = text.match(/\b(\d{7,15})\b/);
        if (match) return `${match[1]}@s.whatsapp.net`;

        return null;
    } catch (err) {
        console.error('extractMentionedJid error:', err);
        return null;
    }
}

/**
 * Handles sudo commands (.sudo add/del/list).
 * @param {object} sock - WhatsApp socket instance
 * @param {string} chatId - Chat ID
 * @param {object} message - WhatsApp message object
 */
async function sudoCommand(sock, chatId, message) {
    try {
        const senderJid = message.key.participant || message.key.remoteJid;
        const ownerJid = `${settings.ownerNumber}@s.whatsapp.net`;
        const isOwner = message.key.fromMe || senderJid === ownerJid;

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = rawText.trim().split(/\s+/).slice(1);
        const sub = (args[0] || '').toLowerCase();

        // ✅ Defensive usage check
        if (!sub || !['add', 'del', 'remove', 'list'].includes(sub)) {
            await sock.sendMessage(chatId, {
                text: [
                    '⚙️ *Sudo Command Usage*',
                    '🔹 .sudo add <@user|number>',
                    '🔹 .sudo del <@user|number>',
                    '🔹 .sudo list'
                ].join('\n')
            }, { quoted: message });
            return;
        }

        // ✅ List sudo users
        if (sub === 'list') {
            const list = await getSudoList();
            if (!list || list.length === 0) {
                await sock.sendMessage(chatId, { text: '📭 No sudo users set.' }, { quoted: message });
                return;
            }
            const text = list.map((j, i) => `${i + 1}. ${j}`).join('\n');
            await sock.sendMessage(chatId, { text: `👑 *Sudo Users:*\n${text}` }, { quoted: message });
            return;
        }

        // ✅ Owner-only restriction
        if (!isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the *owner* can add/remove sudo users.\nUse `.sudo list` to view current sudo users.'
            }, { quoted: message });
            return;
        }

        // ✅ Extract target JID
        const targetJid = extractMentionedJid(message);
        if (!targetJid) {
            await sock.sendMessage(chatId, { text: '⚠️ Please *mention a user* or provide a valid number.' }, { quoted: message });
            return;
        }

        // ✅ Add sudo
        if (sub === 'add') {
            const ok = await addSudo(targetJid);
            await sock.sendMessage(chatId, {
                text: ok ? `✅ Successfully added sudo: *${targetJid}*` : '❌ Failed to add sudo.'
            }, { quoted: message });
            return;
        }

        // ✅ Remove sudo
        if (sub === 'del' || sub === 'remove') {
            if (targetJid === ownerJid) {
                await sock.sendMessage(chatId, { text: '⚠️ Owner cannot be removed from sudo list.' }, { quoted: message });
                return;
            }
            const ok = await removeSudo(targetJid);
            await sock.sendMessage(chatId, {
                text: ok ? `✅ Successfully removed sudo: *${targetJid}*` : '❌ Failed to remove sudo.'
            }, { quoted: message });
            return;
        }
    } catch (err) {
        console.error('sudoCommand error:', err);
        await sock.sendMessage(chatId, { text: '⚠️ An unexpected error occurred while processing sudo command.' }, { quoted: message });
    }
}

module.exports = sudoCommand;
