const fetch = require("node-fetch");

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

async function advanceglowCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || '';
    
    const inputText = text.split(' ').slice(1).join(' ').trim();
    
    if (!inputText) {
        return sock.sendMessage(chatId, { 
            text: "Type some text after .advanceglow"
        }, { quoted: fake });
    }

    if (inputText.length > 50) {
        return sock.sendMessage(chatId, { 
            text: "Text too long, maximum 50 characters"
        }, { quoted: fake });
    }

    try {
        const url = `https://api.nekolabs.web.id/canvas/ephoto/advanced-glow?text=${encodeURIComponent(inputText)}`;
        const response = await fetch(url);

        if (!response.ok) {
            return sock.sendMessage(chatId, { 
                text: "API error. Try again later."
            }, { quoted: fake });
        }

        const buffer = await response.buffer();

        await sock.sendMessage(chatId, {
            image: buffer,
            caption: "DAVE X"
        }, { quoted: fake });

    } catch (error) {
        console.error("Advanceglow Error:", error);
        await sock.sendMessage(chatId, { 
            text: "Failed to generate image."
        }, { quoted: fake });
    }
}

module.exports = advanceglowCommand;