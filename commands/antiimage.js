const { setAntiimage, getAntiimage, removeAntiimage } = require('../lib');
const isAdmin = require('../lib/isAdmin');

function createFakeContact(message) {
    const participantId = message?.key?.participant?.split('@')[0] || 
                          message?.key?.remoteJid?.split('@')[0] || '0';
    
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function antiimageCommand(sock, chatId, message, senderId) {
    try {
        const fake = createFakeContact(message);
        const isSenderAdmin = await isAdmin(sock, chatId, senderId);

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '❌ For Group Admins Only' }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(' ').slice(1);
        const action = args[0]?.toLowerCase();

        if (!action) {
            const usage = `🖼️ *ANTIIMAGE SETUP*\n\nCommands:\n• .antiimage on\n• .antiimage set delete\n• .antiimage set kick\n• .antiimage set warn\n• .antiimage off\n• .antiimage status`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                await setAntiimage(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: '✅ Antiimage has been turned ON\n\n🛡️ Action: Delete image\n\nNon-admins cannot send images' 
                }, { quoted: fake });
                break;

            case 'off':
                await removeAntiimage(chatId);
                await sock.sendMessage(chatId, { 
                    text: '❌ Antiimage has been turned OFF\n\nEveryone can now send images' 
                }, { quoted: fake });
                break;

            case 'set':
                const setAction = args[1]?.toLowerCase();
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { 
                        text: '❌ Invalid action. Choose:\n• delete\n• kick\n• warn' 
                    }, { quoted: fake });
                    return;
                }

                await setAntiimage(chatId, 'on', setAction);

                const actionEmoji = {
                    'delete': '🗑️',
                    'kick': '👢',
                    'warn': '⚠️'
                };

                await sock.sendMessage(chatId, { 
                    text: `✅ Antiimage action set to: ${actionEmoji[setAction]} *${setAction.toUpperCase()}*\n\nStatus: ON` 
                }, { quoted: fake });
                break;

            case 'status':
                const config = await getAntiimage(chatId);

                if (!config || !config.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: '🖼️ *Antiimage Status*\n\n❌ Status: OFF\n\nUse `.antiimage on` to enable' 
                    }, { quoted: fake });
                } else {
                    const actionEmoji = {
                        'delete': '🗑️',
                        'kick': '👢',
                        'warn': '⚠️'
                    };

                    await sock.sendMessage(chatId, { 
                        text: `🖼️ *Antiimage Status*\n\n✅ Status: ON\n${actionEmoji[config.action]} Action: ${config.action.toUpperCase()}\n\n🛡️ Non-admins cannot send images` 
                    }, { quoted: fake });
                }
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid command. Use:\n• on\n• off\n• set\n• status' 
                }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antiimage command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing the command' 
        }, { quoted: fake });
    }
}

async function handleImageDetection(sock, chatId, message, senderId) {
    try {
        const config = await getAntiimage(chatId);

        // If not enabled, return early
        if (!config || !config.enabled) return;

        const hasImage = message.message?.imageMessage;
        if (!hasImage) return;

        // Check if sender is admin
        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return; // Admins are allowed

        console.log(`Antiimage triggered by ${senderId} in ${chatId}`);

        const fake = createFakeContact(message);

        // Execute the configured action
        switch (config.action) {
            case 'delete':
                await sock.sendMessage(chatId, {
                    delete: message.key
                });
                console.log('Image deleted');
                break;

            case 'warn':
                // Delete the image first
                await sock.sendMessage(chatId, {
                    delete: message.key
                });

                // Send warning
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${senderId.split('@')[0]}\n\nSending images is not allowed in this group!\n\nOnly admins can send images.`,
                    mentions: [senderId]
                }, { quoted: fake });

                console.log('Image deleted and warning sent');
                break;

            case 'kick':
                // Delete the image
                await sock.sendMessage(chatId, {
                    delete: message.key
                });

                // Send notification before kicking
                await sock.sendMessage(chatId, {
                    text: `🚫 @${senderId.split('@')[0]} has been removed for sending images.`,
                    mentions: [senderId]
                }, { quoted: fake });

                // Remove the user
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');

                console.log('Image deleted and user kicked');
                break;
        }
    } catch (error) {
        console.error('Error in handleImageDetection:', error);
    }
}

module.exports = {
    antiimageCommand,
    handleImageDetection
};