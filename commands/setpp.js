const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "Davex Profile",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Profile;;;\nFN:Davex Profile Picture\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Profile Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function setProfilePicture(sock, chatId, msg) {
    const fakeContact = createFakeContact(msg);
    
    try {
        if (!msg.key.fromMe) {
            await sock.sendMessage(chatId, { 
                text: 'Restricted to system administrator' 
            }, { quoted: fakeContact });
            return;
        }

        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMessage) {
            await sock.sendMessage(chatId, { 
                text: 'Reply to image with setpicture command' 
            }, { quoted: fakeContact });
            return;
        }

        const imageMessage = quotedMessage.imageMessage || quotedMessage.stickerMessage;
        if (!imageMessage) {
            await sock.sendMessage(chatId, { 
                text: 'Replied content must be visual media' 
            }, { quoted: fakeContact });
            return;
        }

        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);

        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const imagePath = path.join(tmpDir, `profile_${Date.now()}.jpg`);
        fs.writeFileSync(imagePath, buffer);

        await sock.updateProfilePicture(sock.user.id, { url: imagePath });

        fs.unlinkSync(imagePath);

        await sock.sendMessage(chatId, { 
            text: 'Bot display image modified' 
        }, { quoted: fakeContact });

    } catch (error) {
        console.error('Error in setpicture command:', error);
        await sock.sendMessage(chatId, { 
            text: 'Display image modification unsuccessful' 
        }, { quoted: fakeContact });
    }
}

module.exports = setProfilePicture;