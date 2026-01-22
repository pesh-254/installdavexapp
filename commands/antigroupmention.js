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
            const usage = `👥 *GROUP STATUS MENTION PROTECTION*

Commands:
• .antigroupmention on
• .antigroupmention set delete
• .antigroupmention set kick
• .antigroupmention set warn
• .antigroupmention off
• .antigroupmention status

*Actions:*
• delete - Delete the group status mention
• kick - Delete & remove user who mentioned group status
• warn - Delete & warn user

*What it blocks:* When users try to mention the group's status message`;
            
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                await setAntigroupmention(chatId, { enabled: true, action: 'delete' });
                await sock.sendMessage(chatId, { 
                    text: '✅ Group Status Mention Protection has been turned ON\n\n🛡️ Action: Delete message\n\nNon-admins cannot mention group status' 
                }, { quoted: fake });
                break;

            case 'off':
                await setAntigroupmention(chatId, { enabled: false, action: 'delete' });
                await sock.sendMessage(chatId, { 
                    text: '❌ Group Status Mention Protection has been turned OFF\n\nEveryone can now mention group status' 
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

                await setAntigroupmention(chatId, { enabled: true, action: setAction });

                const actionEmoji = {
                    'delete': '🗑️',
                    'kick': '👢',
                    'warn': '⚠️'
                };

                await sock.sendMessage(chatId, { 
                    text: `✅ Group Status Mention action set to: ${actionEmoji[setAction]} *${setAction.toUpperCase()}*\n\nStatus: ON` 
                }, { quoted: fake });
                break;

            case 'status':
            case 'get':
                const config = await getAntigroupmention(chatId);

                if (!config || !config.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: '👥 *Group Status Mention Protection Status*\n\n❌ Status: OFF\n\nUse `.antigroupmention on` to enable' 
                    }, { quoted: fake });
                } else {
                    const actionEmoji = {
                        'delete': '🗑️',
                        'kick': '👢',
                        'warn': '⚠️'
                    };

                    await sock.sendMessage(chatId, { 
                        text: `👥 *Group Status Mention Protection Status*\n\n✅ Status: ON\n${actionEmoji[config.action]} Action: ${config.action.toUpperCase()}\n\n🛡️ Non-admins cannot mention group status` 
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

// SIMPLIFIED VERSION - Using the same detection as your example code
async function handleGroupStatusMention(sock, m) {
    try {
        // Check if it's a group status mention message (same as your example)
        if (m.mtype?.includes("groupStatusMentionMessage") && m.isGroup) {
            const chatId = m.key.remoteJid;
            const senderId = m.sender || m.key.participant;
            
            // Get configuration
            const config = await getAntigroupmention(chatId);
            if (!config || !config.enabled) return;

            // Check if sender is admin
            const senderIsAdmin = await isAdmin(sock, chatId, senderId);
            if (senderIsAdmin) return; // Admins are allowed

            console.log(`Group Status Mention triggered by ${senderId} in ${chatId}`);

            // Execute the configured action
            switch (config.action) {
                case 'delete':
                    // Delete the group status mention
                    try {
                        await sock.sendMessage(chatId, { delete: m.key }); // Baileys v6+
                    } catch {
                        await sock.messageDelete(chatId, m.key); // fallback
                    }
                    
                    console.log('Group status mention deleted');
                    break;

                case 'warn':
                    // Delete first
                    try {
                        await sock.sendMessage(chatId, { delete: m.key });
                    } catch {
                        await sock.messageDelete(chatId, m.key);
                    }

                    // Send warning
                    await sock.sendMessage(chatId, {
                        text: `⚠️ @${senderId.split('@')[0]}\n\nMentioning group status is not allowed!\n\nOnly admins can mention the group status.`,
                        mentions: [senderId]
                    }, { quoted: m });

                    console.log('Group status mention deleted and warning sent');
                    break;

                case 'kick':
                    // Delete first
                    try {
                        await sock.sendMessage(chatId, { delete: m.key });
                    } catch {
                        await sock.messageDelete(chatId, m.key);
                    }

                    // Send notification
                    await sock.sendMessage(chatId, {
                        text: `🚫 @${senderId.split('@')[0]} has been removed for mentioning group status.`,
                        mentions: [senderId]
                    }, { quoted: m });

                    // Remove the user
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');

                    console.log('Group status mention deleted and user kicked');
                    break;
            }
        }
    } catch (error) {
        console.error('Error in handleGroupStatusMention:', error);
    }
}

module.exports = {
    antigroupmentionCommand,
    handleGroupStatusMention // Export the simplified handler
};