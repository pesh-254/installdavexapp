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

async function channelidCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';
    
    const url = text.split(' ').slice(1).join(' ').trim();
    
    if (!url) {
        return sock.sendMessage(chatId, { 
            text: 'Example: .channelid https://whatsapp.com/channel/xxxxxxxx'
        }, { quoted: fake });
    }

    if (!url.includes("https://whatsapp.com/channel/")) {
        return sock.sendMessage(chatId, { 
            text: 'Invalid WhatsApp channel link'
        }, { quoted: fake });
    }

    try {
        const result = url.split('https://whatsapp.com/channel/')[1];
        const res = await sock.newsletterMetadata("invite", result);
        
        const info = `ID: ${res.id}\nName: ${res.name}\nFollower: ${res.subscribers}\nStatus: ${res.state}\nVerified: ${res.verification === "VERIFIED" ? "Yes" : "No"}\n- DAVE X`;

        await sock.sendMessage(chatId, { 
            text: info
        }, { quoted: fake });

    } catch (error) {
        console.error('ChannelID Error:', error);
        await sock.sendMessage(chatId, { 
            text: 'Failed to get channel info'
        }, { quoted: fake });
    }
}

module.exports = channelidCommand;