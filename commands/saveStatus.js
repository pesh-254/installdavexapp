const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Dave-X;;;\nFN:DAVE-X\nTEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function saveStatusCommand(sock, chatId, message) {
    try {
        const fakeContact = createFakeContact(message);

        if (!message.key.fromMe) {
            return sock.sendMessage(chatId, { text: 'Owner only' }, { quoted: fakeContact });
        }

        const quotedInfo = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = quotedInfo?.quotedMessage;

        if (!quotedMsg) {
            await sock.sendMessage(chatId, { text: 'Reply to status' }, { quoted: fakeContact });
            await sock.sendMessage(chatId, { react: { text: '📑', key: message.key } });
            return;
        }

        if (quotedMsg.extendedTextMessage?.text) {
            const text = quotedMsg.extendedTextMessage.text;
            await sock.sendMessage(chatId, { text: 'Text status saved' }, { quoted: fakeContact });
            return sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        }

        let mediaType, extension;
        if (quotedMsg.imageMessage) {
            mediaType = 'image';
            extension = 'jpg';
        } else if (quotedMsg.videoMessage) {
            mediaType = 'video';
            extension = 'mp4';
        } else if (quotedMsg.audioMessage) {
            mediaType = 'audio';
            extension = 'ogg';
        } else {
            await sock.sendMessage(chatId, { text: 'Invalid status' }, { quoted: fakeContact });
            return sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
        await sock.sendMessage(chatId, { text: 'Downloading...' }, { quoted: fakeContact });

        const buffer = await downloadMediaMessage(
            { message: quotedMsg },
            'buffer',
            {},
            { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
        );

        const dirPath = path.join(__dirname, '..', 'data', 'statuses');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filename = `status_${Date.now()}.${extension}`;
        const filepath = path.join(dirPath, filename);

        fs.writeFileSync(filepath, buffer);

        await sock.sendMessage(chatId, {
            [mediaType]: buffer,
            caption: 'DAVE-X the tribal thief ⭐'
        }, { quoted: fakeContact });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Status error:', error.message);
        const fakeContact = createFakeContact(message);
        await sock.sendMessage(chatId, { text: 'Failed to save' }, { quoted: fakeContact });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = saveStatusCommand;