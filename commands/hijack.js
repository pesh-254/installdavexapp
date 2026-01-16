const isAdmin = require('../lib/isAdmin');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: "DAVE-X"
        },
        message: {
            contactMessage: {
                displayName: "DAVE",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:KOLOLI\nitem1.TEL;waid=${message?.key?.participant?.split('@')[0] || '0'}:${message?.key?.participant?.split('@')[0] || '0'}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function hijackCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(message);

        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner!' }, { quoted: fake });
            return;
        }

        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups!' }, { quoted: fake });
            return;
        }

        const adminStatus = await isAdmin(sock, chatId, senderId);
        if (!adminStatus.isBotAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Bot must be an admin to hijack the group!' }, { quoted: fake });
            return;
        }

        await sock.sendMessage(chatId, { text: '🔄 Starting group hijack...' }, { quoted: fake });

        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const nonBotAdmins = admins.filter(a => a.id !== botId);

            let demotedCount = 0;
            for (const admin of nonBotAdmins) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [admin.id], 'demote');
                    demotedCount++;
                    console.log(`[HIJACK] Demoted ${admin.id}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                    console.log(`[HIJACK] Failed to demote ${admin.id}: ${e.message}`);
                }
            }

            const ownerId = message.key.participant || senderId;
            if (ownerId !== botId) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [ownerId], 'promote');
                    console.log(`[HIJACK] Promoted owner ${ownerId}`);
                } catch (e) {
                    console.log(`[HIJACK] Owner already admin or failed: ${e.message}`);
                }
            }

            await sock.sendMessage(chatId, {
                text: `✅ *Group Hijack Complete*\n\n👑 Demoted: ${demotedCount} admin(s)\n🔐 You are now the only admin\n\n⚠️ Use this power responsibly!`
            }, { quoted: fake });

        } catch (error) {
            console.error('Hijack operation error:', error);
            await sock.sendMessage(chatId, { text: `❌ Hijack failed: ${error.message}` }, { quoted: fake });
        }

    } catch (error) {
        console.error('Error in hijack command:', error);
    }
}

module.exports = hijackCommand;
