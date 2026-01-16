const { setAntigroupmention, getAntigroupmention, removeAntigroupmention } = require('../lib');
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

async function antigroupmentionCommand(sock, chatId, message, senderId) {
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
            const usage = `👥 *ANTIGROUPMENTION SETUP*

Commands:
• .antigroupmention on
• .antigroupmention set delete
• .antigroupmention set kick
• .antigroupmention set warn
• .antigroupmention off
• .antigroupmention status

*Actions:*
• delete - Delete the message
• kick - Delete message & remove user
• warn - Delete message & warn user`;

            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                await setAntigroupmention(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: '✅ Antigroupmention has been turned ON\n\n🛡️ Action: Delete message\n\nNon-admins cannot use @everyone or @all' 
                }, { quoted: fake });
                break;

            case 'off':
                // Fixed: Using correct parameters for removeAntigroupmention
                await removeAntigroupmention(chatId, 'off');
                await sock.sendMessage(chatId, { 
                    text: '❌ Antigroupmention has been turned OFF\n\nEveryone can now use group mentions' 
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

                await setAntigroupmention(chatId, 'on', setAction);

                const actionEmoji = {
                    'delete': '🗑️',
                    'kick': '👢',
                    'warn': '⚠️'
                };

                await sock.sendMessage(chatId, { 
                    text: `✅ Antigroupmention action set to: ${actionEmoji[setAction]} *${setAction.toUpperCase()}*\n\nStatus: ON` 
                }, { quoted: fake });
                break;

            case 'status':
            case 'get':
                const config = await getAntigroupmention(chatId, 'on');

                if (!config || !config.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: '👥 *Antigroupmention Status*\n\n❌ Status: OFF\n\nUse `.antigroupmention on` to enable' 
                    }, { quoted: fake });
                } else {
                    const actionEmoji = {
                        'delete': '🗑️',
                        'kick': '👢',
                        'warn': '⚠️'
                    };

                    await sock.sendMessage(chatId, { 
                        text: `👥 *Antigroupmention Status*\n\n✅ Status: ON\n${actionEmoji[config.action]} Action: ${config.action.toUpperCase()}\n\n🛡️ Non-admins cannot use @everyone or @all` 
                    }, { quoted: fake });
                }
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid command. Use:\n• on\n• off\n• set\n• status' 
                }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antigroupmention command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing the command' 
        }, { quoted: fake });
    }
}

async function handleGroupMentionDetection(sock, chatId, message, senderId) {
    try {
        const config = await getAntigroupmention(chatId, 'on');

        // If not enabled, return early
        if (!config || !config.enabled) return;

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || '';

        // Check for @everyone or @all mentions
        const hasTagAll = text.includes('@everyone') || text.includes('@all');

        // Also check if mentioning many users (mass mention detection)
        const mentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const hasMassMention = mentions.length >= 10; // Adjust threshold as needed

        if (!hasTagAll && !hasMassMention) return;

        // Check if sender is admin
        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return; // Admins are allowed

        console.log(`Antigroupmention triggered by ${senderId} in ${chatId}`);

        const fake = createFakeContact(message);

        // Execute the configured action
        switch (config.action) {
            case 'delete':
                await sock.sendMessage(chatId, {
                    delete: message.key
                });
                console.log('Message deleted');
                break;

            case 'warn':
                // Delete the message first
                await sock.sendMessage(chatId, {
                    delete: message.key
                });

                // Send warning
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${senderId.split('@')[0]}\n\nUsing @everyone or @all is not allowed in this group!\n\nOnly admins can use group mentions.`,
                    mentions: [senderId]
                }, { quoted: fake });

                console.log('Message deleted and warning sent');
                break;

            case 'kick':
                // Delete the message
                await sock.sendMessage(chatId, {
                    delete: message.key
                });

                // Send notification before kicking
                await sock.sendMessage(chatId, {
                    text: `🚫 @${senderId.split('@')[0]} has been removed for using unauthorized group mentions.`,
                    mentions: [senderId]
                }, { quoted: fake });

                // Remove the user
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');

                console.log('Message deleted and user kicked');
                break;
        }
    } catch (error) {
        console.error('Error in handleGroupMentionDetection:', error);
    }
}

module.exports = {
    antigroupmentionCommand,
    handleGroupMentionDetection
};