const { isAdmin } = require('../lib/isAdmin');

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
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Dave-X;;;\nFN:DAVE-X\nTEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function promoteCommand(sock, chatId, mentionedJids, message) {
    const fkontak = createFakeContact(message);
    
    let userToPromote = [];

    if (mentionedJids?.length > 0) {
        userToPromote = mentionedJids;
    }
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToPromote = [message.message.extendedTextMessage.contextInfo.participant];
    }

    if (userToPromote.length === 0) {
        await sock.sendMessage(chatId, { 
            text: 'Mention user or reply to promote.'
        }, { quoted: fkontak });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, userToPromote, "promote");

        const promotedUsers = userToPromote.map(jid => `@${jid.split('@')[0]}`).join(', ');

        const promotionMessage = `Promoted: ${promotedUsers}`;

        await sock.sendMessage(chatId, { 
            text: promotionMessage,
            mentions: userToPromote
        }, { quoted: fkontak });
    } catch (error) {
        console.error('Promote error:', error);
        await sock.sendMessage(chatId, { text: 'Failed to promote.'}, { quoted: fkontak });
    }
}

async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        if (!Array.isArray(participants) || participants.length === 0) return;

        const botJid = sock.user.id;
        const authorJid = typeof author === 'string' ? author : (author?.id || '');

        if (authorJid !== botJid) return;

        const promotedUsers = participants.map(jid => {
            const jidString = typeof jid === 'string' ? jid : (jid.id || '');
            return `@${jidString.split('@')[0]}`;
        }).join(', ');

        const promotionMessage = `Promoted: ${promotedUsers}`;

        const mentionList = participants.map(jid => 
            typeof jid === 'string' ? jid : (jid.id || '')
        );

        await sock.sendMessage(groupId, {
            text: promotionMessage,
            mentions: mentionList
        });
    } catch (error) {
        console.error('Promotion event error:', error);
    }
}

module.exports = { promoteCommand, handlePromotionEvent };