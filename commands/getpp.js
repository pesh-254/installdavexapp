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
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function getppCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        
        // Check if user is owner
        const isOwner = message.key.fromMe;
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: 'Command only for the owner.'
            }, { quoted: fake });
            return;
        }

        let userToAnalyze;
        
        // Check for mentioned users
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToAnalyze = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToAnalyze = message.message.extendedTextMessage.contextInfo.participant;
        }
        
        if (!userToAnalyze) {
            await sock.sendMessage(chatId, { 
                text: 'Please mention someone or reply to their message to get their profile picture'
            }, { quoted: fake });

            await sock.sendMessage(chatId, {
                react: { text: '🗑️', key: message.key }
            });
            return;
        }

        try {
            // Get user's profile picture
            let profilePic;
            try {
                profilePic = await sock.profilePictureUrl(userToAnalyze, 'image');
            } catch {
                profilePic = 'https://files.catbox.moe/lvcwnf.jpg'; // Default image
            }

            // Send the profile picture to the chat
            await sock.sendMessage(chatId, {
                image: { url: profilePic },
                caption: `hey Sucess in getting profile of: @${userToAnalyze.split('@')[0]} .`,
                mentions: [userToAnalyze]
            }, { quoted: fake });

            await sock.sendMessage(chatId, {
                react: { text: '☑️', key: message.key }
            });

        } catch (error) {
            console.error('Error in getpp command:', error);
            await sock.sendMessage(chatId, {
                text: 'Failed to retrieve profile picture. The user might not have one set.'
            }, { quoted: fake });
        }
    } catch (error) {
        console.error('Unexpected error in getppCommand:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, {
            text: 'An unexpected error occurred.'
        }, { quoted: fake });
    }
}

module.exports = getppCommand;