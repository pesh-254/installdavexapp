const { setAntivideo, getAntivideo, removeAntivideo } = require('../lib');
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

async function antivideoCommand(sock, chatId, message, senderId) {
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
            const usage = `📹 *ANTIVIDEO SETUP*\n\nCommands:\n• .antivideo on\n• .antivideo set delete\n• .antivideo set kick\n• .antivideo set warn\n• .antivideo off\n• .antivideo status`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                await setAntivideo(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: '✅ Antivideo has been turned ON\n\n🛡️ Action: Delete video\n\nNon-admins cannot send videos' 
                }, { quoted: fake });
                break;

            case 'off':
                await removeAntivideo(chatId);
                await sock.sendMessage(chatId, { 
                    text: '❌ Antivideo has been turned OFF\n\nEveryone can now send videos' 
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

                await setAntivideo(chatId, 'on', setAction);

                const actionEmoji = {
                    'delete': '🗑️',
                    'kick': '👢',
                    'warn': '⚠️'
                };

                await sock.sendMessage(chatId, { 
                    text: `✅ Antivideo action set to: ${actionEmoji[setAction]} *${setAction.toUpperCase()}*\n\nStatus: ON` 
                }, { quoted: fake });
                break;

            case 'status':
            case 'get':
                const config = await getAntivideo(chatId);

                if (!config || !config.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: '📹 *Antivideo Status*\n\n❌ Status: OFF\n\nUse `.antivideo on` to enable' 
                    }, { quoted: fake });
                } else {
                    const actionEmoji = {
                        'delete': '🗑️',
                        'kick': '👢',
                        'warn': '⚠️'
                    };

                    await sock.sendMessage(chatId, { 
                        text: `📹 *Antivideo Status*\n\n✅ Status: ON\n${actionEmoji[config.action]} Action: ${config.action.toUpperCase()}\n\n🛡️ Non-admins cannot send videos` 
                    }, { quoted: fake });
                }
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: '❌ Invalid command. Use:\n• on\n• off\n• set\n• status' 
                }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antivideo command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing the command' 
        }, { quoted: fake });
    }
}

async function handleVideoDetection(sock, chatId, message, senderId) {
    try {
        const config = await getAntivideo(chatId);

        // If not enabled, return early
        if (!config || !config.enabled) return;

        const hasVideo = message.message?.videoMessage;
        if (!hasVideo) return;

        // Check if sender is admin
        const senderIsAdmin = await isAdmin(sock, chatId, senderId);
        if (senderIsAdmin) return; // Admins are allowed

        console.log(`Antivideo triggered by ${senderId} in ${chatId}`);

        const fake = createFakeContact(message);

        // Execute the configured action
        switch (config.action) {
            case 'delete':
                await sock.sendMessage(chatId, {
                    delete: message.key
                });
                console.log('Video deleted');
                break;

            case 'warn':
                // Delete the video first
                await sock.sendMessage(chatId, {
                    delete: message.key
                });

                // Send warning
                await sock.sendMessage(chatId, {
                    text: `⚠️ @${senderId.split('@')[0]}\n\nSending videos is not allowed in this group!\n\nOnly admins can send videos.`,
                    mentions: [senderId]
                }, { quoted: fake });

                console.log('Video deleted and warning sent');
                break;

            case 'kick':
                // Delete the video
                await sock.sendMessage(chatId, {
                    delete: message.key
                });

                // Send notification before kicking
                await sock.sendMessage(chatId, {
                    text: `🚫 @${senderId.split('@')[0]} has been removed for sending videos.`,
                    mentions: [senderId]
                }, { quoted: fake });

                // Remove the user
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');

                console.log('Video deleted and user kicked');
                break;
        }
    } catch (error) {
        console.error('Error in handleVideoDetection:', error);
    }
}

module.exports = {
    antivideoCommand,
    handleVideoDetection
};