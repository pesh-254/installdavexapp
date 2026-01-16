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

async function unmuteCommand(sock, chatId, message) {
    const fkontak = createFakeContact(message);
    
    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');

        const metadata = await sock.groupMetadata(chatId);
        const groupName = metadata?.subject || 'group';

        await sock.sendMessage(chatId, { 
            text: `Unmuted ${groupName}.`
        }, { quoted: fkontak });

        return { success: true, message: `${groupName} unmuted` };

    } catch (error) {
        console.error('Unmute error:', error);

        await sock.sendMessage(chatId, { 
            text: `Failed to unmute.`
        }, { quoted: fkontak });

        return { success: false, message: 'Failed', error };
    }
}

module.exports = unmuteCommand;