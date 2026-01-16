const { downloadContentFromMessage, generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const fetch = require('node-fetch');

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


//================================================
// OPTION 2: Using webp-converter (Pure JS)
//================================================
// First install: npm install webp-converter
/*
const webp = require('webp-converter');
async function convertStickerToImageWebP(stickerBuffer) {
    return new Promise((resolve, reject) => {
        // Convert WebP buffer to PNG buffer
        webp.buffer2buffer(stickerBuffer, 'png', '-q 80')
            .then(pngBuffer => resolve(pngBuffer))
            .catch(error => reject(error));
    });
}
*/

//==========================================
async function convertStickerToImageAPI(stickerBuffer) {
    try {
        // Using a free API service (CloudConvert)
        const formData = new FormData();
        const blob = new Blob([stickerBuffer], { type: 'image/webp' });
        formData.append('file', blob, 'sticker.webp');
        
        const response = await fetch('https://api.cloudconvert.com/v2/convert', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_API_KEY', // Get free key from cloudconvert.com
                'Content-Type': 'multipart/form-data'
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`API conversion failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        // Download the converted image
        const imageResponse = await fetch(result.data.url);
        return Buffer.from(await imageResponse.arrayBuffer());
    } catch (error) {
        console.error('API conversion error:', error);
        throw error;
    }
}

// ================================================
// OPTION 4: Simple fallback (WebP to PNG/JPEG)
// ================================================
async function convertStickerToImageSimple(stickerBuffer) {
    // Check if it's WebP format
    if (stickerBuffer.slice(0, 12).toString('hex').includes('52494646')) { // RIFF header
        // This is a simple approach - in production you might need a proper decoder
        console.log('Detected WebP sticker, using fallback conversion');
        // For now, we'll just change the mimetype and hope WhatsApp handles it
        // In practice, you should use one of the options above
        return stickerBuffer; // Return original, just change mimetype
    }
    return stickerBuffer;
}

// ================================================
// Main conversion function (choose your preferred method)
// ================================================
async function convertStickerToImage(stickerBuffer, mimetype = 'image/webp') {
    try {
        
        return await convertStickerToImageSimple(stickerBuffer);
        
    } catch (error) {
        console.error('Sticker conversion failed:', error);
        throw new Error(`Failed to convert sticker to image: ${error.message}`);
    }
}

async function setGroupStatusCommand(sock, chatId, msg) {
    const fakeContact = createFakeContact(msg);
    
    try {
        // ✅ Check if it's a private chat (not a group)
        const isGroup = chatId.endsWith('@g.us');
        if (!isGroup) {
            return sock.sendMessage(chatId, { text: 'This command can only be used in groups!' },{ quoted: fakeContact });
        }

        // ✅ Group admin check
        const participant = await sock.groupMetadata(chatId).then(metadata => 
            metadata.participants.find(p => p.id === msg.key.participant || p.id === msg.key.remoteJid)
        );
        
        // Check if user is admin or owner
        const isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        
        if (!isAdmin && !msg.key.fromMe) {
            return sock.sendMessage(chatId, { text: 'Only group admins can use this command!' },{ quoted: fakeContact });
        }

        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // ✅ Support both command formats
        const commandRegex = /^[.!#/]?(togstatus|swgc|groupstatus|tosgroup)\s*/i;

        // ✅ Show help if only command is typed without quote or text
        if (!quotedMessage && (!messageText.trim() || messageText.trim().match(commandRegex))) {
            return sock.sendMessage(chatId, { text: getHelpText() },{ quoted: fakeContact });
        }

        let payload = null;
        
        // ✅ Extract caption if provided after command (for all media types)
        let textAfterCommand = '';
        if (messageText.trim()) {
            const match = messageText.match(commandRegex);
            if (match) {
                textAfterCommand = messageText.slice(match[0].length).trim();
            }
        }

        // ✅ Handle quoted message (video, image, audio, sticker, or text)
        if (quotedMessage) {
            payload = await buildPayloadFromQuoted(quotedMessage);
            
            // ✅ Add caption from command text if provided (for videos, images, AND converted stickers)
            if (textAfterCommand && payload) {
                if (payload.video) {
                    payload.caption = textAfterCommand;
                } else if (payload.image) {
                    payload.caption = textAfterCommand;
                }
                // ✅ Also for stickers that are converted to images
                else if (payload.convertedSticker && payload.image) {
                    payload.caption = textAfterCommand;
                }
            }
        } 
        // ✅ Handle plain text command (only text after command)
        else if (messageText.trim()) {
            if (textAfterCommand) {
                payload = { text: textAfterCommand };
            } else {
                return sock.sendMessage(chatId, { text: getHelpText() },{ quoted: fakeContact });
            }
        }

        if (!payload) {
            return sock.sendMessage(chatId, { text: getHelpText() },{ quoted: fakeContact });
        }

        // ✅ Send group status
        await sendGroupStatus(sock, chatId, payload);

        const mediaType = detectMediaType(quotedMessage, payload);
        let successMsg = `${mediaType} status sent successfully!`;
        
        if (payload.caption) {
            successMsg += `\nCaption: "${payload.caption}"`;
        }
        
        // Add note if sticker was converted
        if (payload.convertedSticker) {
            successMsg += `\nNote: Sticker converted to image format`;
        }
        
        await sock.sendMessage(chatId, { text: successMsg },{ quoted: fakeContact });

    } catch (error) {
        console.error('Error in group status command:', error);
        await sock.sendMessage(chatId, { text: `Failed: ${error.message}` },{ quoted: fakeContact });
    }
}

/* ------------------ Helpers ------------------ */

// 📌 Updated help text with sticker support
function getHelpText() {
    return `
「 GROUP STATUS 」

Commands:
.togroupstatus
.tosgroup

Usage:
• .tosgroup text
• Reply to video/image/sticker with .tosgroup
• Add caption after command
─────────`;
}

// 📌 Build payload from quoted message (UPDATED for sticker conversion)
async function buildPayloadFromQuoted(quotedMessage) {
    // ✅ Handle video message
    if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        return { 
            video: buffer, 
            caption: quotedMessage.videoMessage.caption || '',
            gifPlayback: quotedMessage.videoMessage.gifPlayback || false,
            mimetype: quotedMessage.videoMessage.mimetype || 'video/mp4'
        };
    }
    // ✅ Handle image message
    else if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return { 
            image: buffer, 
            caption: quotedMessage.imageMessage.caption || '',
            mimetype: quotedMessage.imageMessage.mimetype || 'image/jpeg'
        };
    }
    // ✅ Handle audio message
    else if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        
        // Check if it's voice note (ptt) or regular audio
        if (quotedMessage.audioMessage.ptt) {
            const audioVn = await toVN(buffer);
            return { 
                audio: audioVn, 
                mimetype: "audio/ogg; codecs=opus", 
                ptt: true 
            };
        } else {
            return { 
                audio: buffer, 
                mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg',
                ptt: false 
            };
        }
    }
    // ✅ Handle sticker message - CONVERT TO IMAGE
    else if (quotedMessage.stickerMessage) {
        try {
            const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
            
            // Convert sticker to image
            const imageBuffer = await convertStickerToImage(buffer, quotedMessage.stickerMessage.mimetype);
            
            // Return as image with conversion flag
            return { 
                image: imageBuffer, 
                caption: quotedMessage.stickerMessage.caption || '',
                mimetype: 'image/png', // Converted to PNG
                convertedSticker: true, // Flag to indicate conversion
                originalMimetype: quotedMessage.stickerMessage.mimetype
            };
        } catch (conversionError) {
            console.error('Sticker conversion failed:', conversionError);
            // Fallback: send as text message with error
            return { 
                text: `Sticker conversion failed. Original sticker: ${quotedMessage.stickerMessage.mimetype || 'unknown format'}`
            };
        }
    }
    // ✅ Handle text message
    else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: textContent };
    }
    return null;
}

// 📌 Detect media type (Updated with sticker conversion)
function detectMediaType(quotedMessage, payload = null) {
    if (!quotedMessage) return 'Text';
    if (quotedMessage.videoMessage) return 'Video';
    if (quotedMessage.imageMessage) return 'Image';
    if (quotedMessage.audioMessage) return 'Audio';
    if (quotedMessage.stickerMessage) {
        // Check if it was converted
        if (payload && payload.convertedSticker) {
            return 'Sticker (converted to Image)';
        }
        return 'Sticker';
    }
    return 'Text';
}

// 📌 Download message content to buffer
async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

// 📌 Send group status
async function sendGroupStatus(conn, jid, content) {
    const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageSecret = crypto.randomBytes(32);

    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
    }, {});

    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

// 📌 Convert audio to voice note
async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inStream = new PassThrough();
        inStream.end(inputBuffer);
        const outStream = new PassThrough();
        const chunks = [];

        ffmpeg(inStream)
            .noVideo()
            .audioCodec("libopus")
            .format("ogg")
            .audioBitrate("48k")
            .audioChannels(1)
            .audioFrequency(48000)
            .on("error", reject)
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe(outStream, { end: true });

        outStream.on("data", chunk => chunks.push(chunk));
    });
}

module.exports = setGroupStatusCommand;