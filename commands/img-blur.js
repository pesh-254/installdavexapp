const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const Jimp = require('jimp');
const webp = require('webp-converter');
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
                displayName: "DaveX Blur Effect",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:X;Dave;;;\nFN:DaveX Bot\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:BOT\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function blurCommand(sock, chatId, message, quotedMessage) {
    const inputPath = path.resolve('./temp_input.jpg');
    const lowQualityPath = path.resolve('./temp_low.webp');
    const finalPath = path.resolve('./temp_blur.jpg');
    
    const fkontak = createFakeContact(message);

    try {
        // ==== Step 1: Extract image buffer ====
        let imageBuffer;
        if (quotedMessage?.imageMessage) {
            const quoted = { message: { imageMessage: quotedMessage.imageMessage } };
            imageBuffer = await downloadMediaMessage(quoted, 'buffer', {}, {});
        } else if (message?.message?.imageMessage) {
            imageBuffer = await downloadMediaMessage(message, 'buffer', {}, {});
        } else {
            return sock.sendMessage(chatId, {
                text: 'Reply to an image or send an image with caption .blur'
            }, { quoted: fkontak });
        }

        // Defensive check
        if (!imageBuffer) {
            throw new Error('No image buffer retrieved');
        }

        // ==== Step 2: Save original buffer ====
        fs.writeFileSync(inputPath, imageBuffer);

        // ==== Step 3: Convert to low-quality WebP (blur effect) ====
        await webp.cwebp(inputPath, lowQualityPath, "-q 20", "-v");

        // ==== Step 4: Convert back to JPG with reduced quality ====
        const blurryImage = await Jimp.read(lowQualityPath);
        await blurryImage.quality(70).writeAsync(finalPath);

        const finalBuffer = fs.readFileSync(finalPath);

        // ==== Step 5: Send blurred image ====
        await sock.sendMessage(chatId, {
            image: finalBuffer,
            caption: 'Image blurred successfully'
        }, { quoted: fkontak });

    } catch (error) {
        console.error("BLUR ERROR:", error);
        await sock.sendMessage(chatId, {
            text: 'Failed to blur image.'
        }, { quoted: fkontak });
    } finally {
        // ==== Cleanup temp files safely ====
        [inputPath, lowQualityPath, finalPath].forEach(file => {
            if (fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch (err) {
                    console.warn(`Failed to delete ${file}:`, err);
                }
            }
        });
    }
}

module.exports = blurCommand;