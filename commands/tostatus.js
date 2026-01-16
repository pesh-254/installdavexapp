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
                displayName: "Davex Status Bot",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:Davex Status Bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Status Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

function getContextInfo(message) {
    return (
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo ||
        message.message?.stickerMessage?.contextInfo ||
        message.message?.documentMessage?.contextInfo ||
        message.message?.audioMessage?.contextInfo
    );
}

async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function tostatusCommand(sock, chatId, message) {
    const fake = createFakeContact(message);

    if (!message.key.fromMe) {
        return sock.sendMessage(chatId, { 
            text: 'Owner only command'
        }, { quoted: fake });
    }

    const contextInfo = getContextInfo(message);
    const quotedMessage = contextInfo?.quotedMessage;

    if (!quotedMessage) {
        return sock.sendMessage(chatId, { 
            text: 'Reply to an image/video/text to post to status'
        }, { quoted: fake });
    }

    try {
        const msgType = Object.keys(quotedMessage)[0];
        let statusMessage = null;

        if (msgType === 'imageMessage') {
            const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');

            // For status, we need to send to status@broadcast
            await sock.sendMessage('status@broadcast', {
                image: buffer,
                caption: quotedMessage.imageMessage?.caption || "",
                backgroundColor: '#000000'
            }, {
                statusJidList: [] // Empty array for personal status
            });

        } else if (msgType === 'videoMessage') {
            const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');

            await sock.sendMessage('status@broadcast', {
                video: buffer,
                caption: quotedMessage.videoMessage?.caption || "",
                gifPlayback: quotedMessage.videoMessage?.gifPlayback || false,
                backgroundColor: '#000000'
            }, {
                statusJidList: []
            });

        } else if (msgType === 'conversation') {
            await sock.sendMessage('status@broadcast', {
                text: quotedMessage.conversation,
                backgroundColor: '#000000'
            }, {
                statusJidList: []
            });

        } else if (msgType === 'extendedTextMessage') {
            await sock.sendMessage('status@broadcast', {
                text: quotedMessage.extendedTextMessage?.text || "",
                backgroundColor: '#000000'
            }, {
                statusJidList: []
            });

        } else if (msgType === 'stickerMessage') {
            return sock.sendMessage(chatId, { 
                text: 'Stickers cannot be posted to status. Reply to image, video, or text instead.'
            }, { quoted: fake });

        } else {
            return sock.sendMessage(chatId, { 
                text: `Unsupported message type: ${msgType}\nPlease reply to image, video, or text.`
            }, { quoted: fake });
        }

        await sock.sendMessage(chatId, { 
            text: `Successfully posted to status!`
        }, { quoted: fake });

    } catch (error) {
        console.error('Tostatus Error:', error);
        
        await sock.sendMessage(chatId, { 
            text: `Failed to post status\nError: ${error.message}`
        }, { quoted: fake });
    }
}

module.exports = tostatusCommand;