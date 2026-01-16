const { setAntidemote, getAntidemote, removeAntidemote } = require('../lib');
const isAdmin = require('../lib/isAdmin');

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

async function antidemoteCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(message);
        const isSenderAdmin = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ For Group Admins Only' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        if (!action) {
            const usage = `🛡️ *ANTIDEMOTE SETUP*\n\n• .antidemote on - Prevent demoting admins\n• .antidemote off - Allow demoting\n• .antidemote status - Check status`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                await setAntidemote(chatId, 'on');
                await sock.sendMessage(chatId, { 
                    text: '🛡️ Antidemote has been turned ON\n\nAdmins cannot be demoted in this group!' 
                }, { quoted: fake });
                break;

            case 'off':
                await removeAntidemote(chatId);
                await sock.sendMessage(chatId, { 
                    text: '❌ Antidemote has been turned OFF\n\nAdmins can now be demoted normally' 
                }, { quoted: fake });
                break;

            case 'status':
            case 'get':
                const config = await getAntidemote(chatId);
                const statusText = `🛡️ *Antidemote Status*\n\nStatus: ${config.enabled ? '✅ ON' : '❌ OFF'}\n\n${config.enabled ? 'Admins are protected from demotion' : 'No protection active'}`;
                await sock.sendMessage(chatId, { text: statusText }, { quoted: fake });
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid command. Use:\n• on\n• off\n• status' 
                }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antidemote command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing the command' 
        }, { quoted: fake });
    }
}

async function handleAntidemote(sock, chatId, participants, author) {
    try {
        const config = await getAntidemote(chatId);
        if (!config.enabled) return false;

        // Check if the author (who demoted) is admin
        const authorIsAdmin = await isAdmin(sock, chatId, author);
        if (!authorIsAdmin) return false; // Only protect against admin demotions

        // Get group participants info
        const groupMetadata = await sock.groupMetadata(chatId);
        
        // Only re-promote if they were admins before
        for (const participant of participants) {
            const wasAdmin = groupMetadata.participants.find(p => p.id === participant)?.admin;
            if (wasAdmin) {
                await sock.groupParticipantsUpdate(chatId, [participant], 'promote');
                console.log(`[ANTIDEMOTE] Re-promoted ${participant} in ${chatId}`);
                
                // Send notification
                await sock.sendMessage(chatId, {
                    text: `🛡️ *Antidemote Active*\n\n@${participant.split('@')[0]} was re-promoted to admin.\nAdmins are protected in this group!`,
                    mentions: [participant]
                });
            }
        }

        return true;
    } catch (error) {
        console.error('Error in handleAntidemote:', error);
        return false;
    }
}

module.exports = {
    antidemoteCommand,
    handleAntidemote
};