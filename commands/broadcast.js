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

async function broadcastCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    
    if (!message.key.fromMe) {
        return sock.sendMessage(chatId, { 
            text: 'Owner only command'
        }, { quoted: fake });
    }

    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';
    
    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (!text && !quotedMessage?.imageMessage) {
        return sock.sendMessage(chatId, { 
            text: 'Reply to image or type text'
        }, { quoted: fake });
    }

    try {
        const groups = Object.keys(await sock.groupFetchAllParticipating());
        
        await sock.sendMessage(chatId, { 
            text: `Broadcasting to ${groups.length} groups...`
        }, { quoted: fake });

        const channelInfo = {
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363400480173280@newsletter',
                    newsletterName: "DAVE X",
                    serverMessageId: -1
                }
            }
        };

        const broadcastText = `Broadcast by owner\n${text}`;

        for (let groupId of groups) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
                if (quotedMessage?.imageMessage) {
                    const buffer = await sock.downloadMediaMessage(quotedMessage);
                    await sock.sendMessage(groupId, {
                        image: buffer,
                        caption: broadcastText,
                        ...channelInfo
                    });
                } else {
                    await sock.sendMessage(groupId, {
                        text: broadcastText,
                        ...channelInfo
                    });
                }
            } catch (err) {
                console.error(`Broadcast to ${groupId} failed:`, err);
            }
        }

        await sock.sendMessage(chatId, { 
            text: 'Broadcast finished'
        }, { quoted: fake });

    } catch (error) {
        console.error('Broadcast Error:', error);
        await sock.sendMessage(chatId, { 
            text: 'Failed to broadcast'
        }, { quoted: fake });
    }
}

module.exports = broadcastCommand;