function createFakeContact(message, botName = "KOLOLI") {
    const participant = message?.key?.participant || message?.key?.remoteJid || "0";
    const number = participant.split('@')[0];
    
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            fromMe: false,
            id: `${botName}-BOT`
        },
        message: {
            contactMessage: {
                displayName: botName,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:${botName}\nitem1.TEL;waid=${number}:${number}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

module.exports = { createFakeContact };
