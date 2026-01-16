const { setAntipromote, getAntipromote, removeAntipromote } = require('../lib');
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

async function antipromoteCommand(sock, chatId, message, senderId) {
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
            const usage = `🛡️ *ANTIPROMOTE SETUP*\n\nCommands:\n• .antipromote on\n• .antipromote off\n• .antipromote status`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                await setAntipromote(chatId, 'on');
                await sock.sendMessage(chatId, { 
                    text: '✅ Antipromote has been turned ON\n\n🛡️ Unauthorized promotions will be automatically reversed' 
                }, { quoted: fake });
                break;

            case 'off':
                await removeAntipromote(chatId);
                await sock.sendMessage(chatId, { 
                    text: '❌ Antipromote has been turned OFF\n\nPromotions can now happen normally' 
                }, { quoted: fake });
                break;

            case 'status':
            case 'get':
                const config = await getAntipromote(chatId);
                const statusText = `🛡️ *Antipromote Status*\n\nStatus: ${config.enabled ? '✅ ON' : '❌ OFF'}\n\n${config.enabled ? 'Unauthorized promotions are blocked' : 'No protection active'}`;
                await sock.sendMessage(chatId, { text: statusText }, { quoted: fake });
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid command. Use:\n• on\n• off\n• status' 
                }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antipromote command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing the command' 
        }, { quoted: fake });
    }
}

async function handleAntipromote(sock, chatId, participants, author) {
    try {
        const config = await getAntipromote(chatId);
        if (!config.enabled) return false;

        // Check if the author (who promoted) is admin
        const authorIsAdmin = await isAdmin(sock, chatId, author);
        if (authorIsAdmin) return false; // Allow admin promotions

        // Demote all promoted participants
        for (const participant of participants) {
            await sock.groupParticipantsUpdate(chatId, [participant], 'demote');
            console.log(`[ANTIPROMOTE] Demoted ${participant} in ${chatId}`);
            
            // Send notification for each demotion
            await sock.sendMessage(chatId, {
                text: `🛡️ *Antipromote Active*\n\n@${participant.split('@')[0]} was demoted.\nUnauthorized promotions are blocked in this group!`,
                mentions: [participant]
            });
        }

        return true;
    } catch (error) {
        console.error('Error in handleAntipromote:', error);
        return false;
    }
}

module.exports = {
    antipromoteCommand,
    handleAntipromote
};