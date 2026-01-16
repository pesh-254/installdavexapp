const Obfuscator = require("javascript-obfuscator");

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

function extractQuotedText(message) {
    // Get the context info from different message types
    const contextInfo = 
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        message.message?.documentMessage?.contextInfo ||
        message.message?.audioMessage?.contextInfo;

    if (!contextInfo?.quotedMessage) return null;

    const quoted = contextInfo.quotedMessage;

    // Extract text from various message types
    return (
        quoted.conversation ||
        quoted.extendedTextMessage?.text ||
        quoted.imageMessage?.caption ||
        quoted.videoMessage?.caption ||
        quoted.documentMessage?.caption ||
        quoted.documentMessage?.fileName ||
        null
    );
}

async function encryptCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    const code = extractQuotedText(message);

    if (code) {
        try {
            const obfuscationResult = Obfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 1,
                numbersToExpressions: true,
                simplify: true,
                stringArrayShuffle: true,
                splitStrings: true,
                stringArrayThreshold: 1
            });

            const encryptedCode = obfuscationResult.getObfuscatedCode();

            await sock.sendMessage(chatId, { 
                text: encryptedCode
            }, { quoted: fake });

        } catch (error) {
            console.error("Encrypt Error:", error);
            await sock.sendMessage(chatId, { 
                text: `❌ Failed to encrypt code.\n\nError: ${error.message}`
            }, { quoted: fake });
        }
    } else {
        await sock.sendMessage(chatId, { 
            text: "⚠️ Please reply to a message containing JavaScript code to encrypt!"
        }, { quoted: fake });
    }
}

module.exports = encryptCommand;