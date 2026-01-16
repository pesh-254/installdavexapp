const { setAntibug, getAntibug, removeAntibug, isBugMessage } = require('../lib');
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

async function antibugCommand(sock, chatId, message, senderId) {
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
            const usage = `🛡️ *ANTIBUG SETUP*\n\nCommands:\n• .antibug on\n• .antibug set delete\n• .antibug set kick\n• .antibug set warn\n• .antibug off\n• .antibug status`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                await setAntibug(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: '✅ Antibug has been turned ON\n\n🛡️ Action: Delete bug/crash messages\n\nProtecting group from malicious messages' 
                }, { quoted: fake });
                break;

            case 'off':
                await removeAntibug(chatId);
                await sock.sendMessage(chatId, { 
                    text: '❌ Antibug has been turned OFF\n\nNo protection against crash messages' 
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

                await setAntibug(chatId, 'on', setAction);

                const actionEmoji = {
                    'delete': '🗑️',
                    'kick': '👢',
                    'warn': '⚠️'
                };

                await sock.sendMessage(chatId, { 
                    text: `✅ Antibug action set to: ${actionEmoji[setAction]} *${setAction.toUpperCase()}*\n\nStatus: ON` 
                }, { quoted: fake });
                break;

            case 'status':
            case 'get':
                const config = await getAntibug(chatId);

                if (!config || !config.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: '🛡️ *Antibug Status*\n\n❌ Status: OFF\n\nUse `.antibug on` to enable' 
                    }, { quoted: fake });
                } else {
                    const actionEmoji = {
                        'delete': '🗑️',
                        'kick': '👢',
                        'warn': '⚠️'
                    };

                    await sock.sendMessage(chatId, { 
                        text: `🛡️ *Antibug Status*\n\n✅ Status: ON\n${actionEmoji[config.action]} Action: ${config.action.toUpperCase()}\n\n🛡️ Protecting group from crash/bug messages` 
                    }, { quoted: fake });
                }
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid command. Use:\n• on\n• off\n• set\n• status' 
                }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antibug command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing the command' 
        }, { quoted: fake });
    }
}

async function handleBugDetection(sock, chatId, message, senderId) {
    try {
        const config = await getAntibug(chatId);

        // If not enabled, return early
        if (!config || !config.enabled) return;

        // Check if message is a bug/crash message
        if (!isBugMessage(message)) return;

        // Check if sender is admin
        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return; // Admins are allowed

        console.log(`Antibug triggered by ${senderId} in ${chatId}`);

        const fake = createFakeContact(message);

        // Execute the configured action
        switch (config.action) {
            case 'delete':
                await sock.sendMessage(chatId, {
                    delete: message.key
                });
                console.log('Bug message deleted');
                break;

            case 'warn':
                // Delete the bug message first
                await sock.sendMessage(chatId, {
                    delete: message.key
                });

                // Send warning
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${senderId.split('@')[0]}\n\nSending crash/bug messages is not allowed!\n\nSuch messages can crash WhatsApp.`,
                    mentions: [senderId]
                }, { quoted: fake });

                console.log('Bug message deleted and warning sent');
                break;

            case 'kick':
                // Delete the bug message
                await sock.sendMessage(chatId, {
                    delete: message.key
                });

                // Send notification before kicking
                await sock.sendMessage(chatId, {
                    text: `🚫 @${senderId.split('@')[0]} has been removed for sending crash/bug messages.`,
                    mentions: [senderId]
                }, { quoted: fake });

                // Remove the user
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');

                console.log('Bug message deleted and user kicked');
                break;
        }
    } catch (error) {
        console.error('Error in handleBugDetection:', error);
    }
}

module.exports = {
    antibugCommand,
    handleBugDetection
};