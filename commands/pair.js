const axios = require('axios');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "KOLOLI",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:KOLOLI\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function pairCommand(sock, chatId, q, message) {
    try {
        const fake = message ? createFakeContact(message) : null;

        if (!q) {
            const usage = `📱 *PAIR COMMAND*\n\nUsage: .pair <phone_number>\n\nExample: .pair 2348012345678\n\n📱 Pairing mode active...`;
            return sock.sendMessage(chatId, { text: usage }, fake ? { quoted: fake } : undefined);
        }

        const phoneNumber = q.replace(/[^0-9]/g, '');

        if (phoneNumber.length < 10 || phoneNumber.length > 15) {
            return sock.sendMessage(chatId, { 
                text: "❌ Invalid phone number format. Please use international format without + sign.\n\nExample: 2348012345678" 
            }, fake ? { quoted: fake } : undefined);
        }

        const whatsappID = phoneNumber + '@s.whatsapp.net';
        const result = await sock.onWhatsApp(whatsappID);

        if (!result[0]?.exists) {
            return sock.sendMessage(chatId, { text: "❌ Number not on WhatsApp!" }, fake ? { quoted: fake } : undefined);
        }

        await sock.sendMessage(chatId, { 
            text: `📱 *Pairing Mode Active*\n\n🔄 Generating pairing code for: ${phoneNumber}\n\nPlease wait...` 
        }, fake ? { quoted: fake } : undefined);

        const response = await axios.get(`https://session-v35f.onrender.com/code?number=${phoneNumber}`);
        const pairingCode = response.data?.code;

        if (!pairingCode) {
            return sock.sendMessage(chatId, { text: "❌ Failed to get pairing code. Try again later." }, fake ? { quoted: fake } : undefined);
        }

        await sock.sendMessage(chatId, { 
            text: `📱 *PAIRING CODE GENERATED*\n\n✅ Phone: ${phoneNumber}\n🔑 Code: *${pairingCode}*\n\n⏳ This code expires in 60 seconds.\n\n📝 Instructions:\n1. Open WhatsApp on the target device\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code above when prompted` 
        }, fake ? { quoted: fake } : undefined);

        await new Promise(resolve => setTimeout(resolve, 2000));
        await sock.sendMessage(chatId, { text: pairingCode });

    } catch (error) {
        console.error('Pair command error:', error);
        await sock.sendMessage(chatId, { text: "❌ Error generating pairing code. Try again later." });
    }
}

module.exports = pairCommand;
