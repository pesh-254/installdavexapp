const isAdmin = require('../lib/isAdmin');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Fake contact creator 😜
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX Stealth Mode",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:X;Dave;;;\nFN:DaveX Bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:BOT\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const filePath = path.join(__dirname, '../temp/', `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

async function hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    // Use the fake contact for quoted messages
    const fkontak = createFakeContact(message);

    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { 
            text: 'I need admin powers to work this magic!' 
        }, { quoted: fkontak });
        return;
    }

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { 
            text: 'Admins only zone! You need the badge for this.' 
        }, { quoted: fkontak });
        return;
    }

    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants || [];
    const nonAdmins = participants.filter(p => !p.admin).map(p => p.id);

    if (replyMessage) {
        let content = {};
        if (replyMessage.imageMessage) {
            const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
            content = { 
                image: { url: filePath }, 
                caption: messageText || replyMessage.imageMessage.caption || '', 
                mentions: nonAdmins 
            };
        } else if (replyMessage.videoMessage) {
            const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
            content = { 
                video: { url: filePath }, 
                caption: messageText || replyMessage.videoMessage.caption || '', 
                mentions: nonAdmins 
            };
        } else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
            content = { 
                text: replyMessage.conversation || replyMessage.extendedTextMessage.text, 
                mentions: nonAdmins 
            };
        } else if (replyMessage.documentMessage) {
            const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
            content = { 
                document: { url: filePath }, 
                fileName: replyMessage.documentMessage.fileName, 
                caption: messageText || '', 
                mentions: nonAdmins 
            };
        }

        if (Object.keys(content).length > 0) {
            await sock.sendMessage(chatId, content);
        }
    } else {
        await sock.sendMessage(chatId, { 
            text: messageText || 'Stealth tagging complete! (Admins excluded)', 
            mentions: nonAdmins 
        });
    }
}

module.exports = hideTagCommand;