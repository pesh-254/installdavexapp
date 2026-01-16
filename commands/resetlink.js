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
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function resetlinkCommand(sock, chatId, senderId, message) {
    const fake = createFakeContact(message);
    
    try {
        const groupMetadata = await sock.groupMetadata(chatId);

        const isAdmin = groupMetadata.participants.some(p => 
            p.id === senderId && p.admin
        );

        const botUser = sock.user || sock.state?.legacy?.user;
        let botId;

        if (botUser && botUser.id) {
            const rawId = botUser.id.includes(':') ? botUser.id.split(':')[0] : botUser.id;
            botId = `${rawId}@s.whatsapp.net`;
        } else {
            const phoneNumber = sock.authState?.creds?.me?.id || '1234567890';
            botId = `${phoneNumber.split(':')[0]}@s.whatsapp.net`;
        }

        const isBotAdmin = groupMetadata.participants.some(p => 
            p.id === botId && p.admin
        );

        if (!isAdmin) {
            await sock.sendMessage(chatId, { 
                text: 'Only admins can use this command' 
            }, { quoted: fake });
            return;
        }

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { 
                text: 'Bot must be admin to reset group link' 
            }, { quoted: fake });
            return;
        }

        const newCode = await sock.groupRevokeInvite(chatId);

        await sock.sendMessage(chatId, { 
            text: `Group link reset\n\nhttps://chat.whatsapp.com/${newCode}\n\nOld link invalid\n- DAVE X`
        }, { quoted: fake });

    } catch (error) {
        console.error('Resetlink Error:', error);
        await sock.sendMessage(chatId, { 
            text: `Failed to reset group link`
        }, { quoted: fake });
    }
}

module.exports = resetlinkCommand;