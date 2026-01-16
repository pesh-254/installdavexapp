const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

// Link detection patterns
const linkPatterns = {
    whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/,
    whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/,
    telegram: /t\.me\/[A-Za-z0-9_]+/,
    allLinks: /https?:\/\/[^\s]+/,
};

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DaveX\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// Check if message contains links
function containsLink(text) {
    if (!text) return false;

    if (linkPatterns.whatsappGroup.test(text)) return true;
    if (linkPatterns.whatsappChannel.test(text)) return true;
    if (linkPatterns.telegram.test(text)) return true;
    if (linkPatterns.allLinks.test(text)) return true;

    return false;
}

// Enforcement handler
async function enforce(sock, chatId, sender, msg, action) {
    const quotedMessageId = msg.key.id;
    const quotedParticipant = msg.key.participant || sender;

    switch (action) {
        case 'warn':
            const fake = createFakeContact(msg);
            const mentionedJidList = [sender];
            await sock.sendMessage(chatId, { 
                text: `Warning! @${sender.split('@')[0]}, posting links is not allowed.`, 
                mentions: mentionedJidList 
            }, { quoted: fake });
            return { success: true, action: 'warned' };

        case 'delete':
            try {
                await sock.sendMessage(chatId, {
                    delete: { 
                        remoteJid: chatId, 
                        fromMe: false, 
                        id: quotedMessageId, 
                        participant: quotedParticipant 
                    }
                });
                console.log(`Message with ID ${quotedMessageId} deleted successfully.`);
                return { success: true, action: 'deleted' };
            } catch (e) {
                console.error('Delete failed:', e);
                return { success: false, error: e };
            }

        case 'kick':
            try {
                try {
                    await sock.sendMessage(chatId, {
                        delete: { 
                            remoteJid: chatId, 
                            fromMe: false, 
                            id: quotedMessageId, 
                            participant: quotedParticipant 
                        }
                    });
                } catch (deleteError) {
                    console.warn('Failed to delete message before kicking:', deleteError);
                }

                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                console.log(`User ${sender} kicked for posting link.`);

                const fake = createFakeContact(msg);
                await sock.sendMessage(chatId, { 
                    text: `User @${sender.split('@')[0]} has been removed for posting links.`,
                    mentions: [sender]
                }, { quoted: fake });

                return { success: true, action: 'kicked' };
            } catch (e) {
                console.error('Kick failed:', e);

                try {
                    await sock.sendMessage(chatId, {
                        delete: { 
                            remoteJid: chatId, 
                            fromMe: false, 
                            id: quotedMessageId, 
                            participant: quotedParticipant 
                        }
                    });
                } catch (deleteError) {
                    console.error('Fallback delete failed:', deleteError);
                }

                return { success: false, error: e };
            }

        default:
            return { success: false, error: 'Invalid action' };
    }
}

/**
 * Handle Antilink Command
 */
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin) {
    try {
        const fake = createFakeContact({ key: { participant: senderId, remoteJid: chatId } });
        
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'For Group Admins Only' }, { quoted: fake });
            return;
        }

        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `ANTILINK SETUP\n\n.antilink on\n.antilink set delete | kick | warn\n.antilink off\n.antilink get\n.antilink help`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on': {
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: 'Antilink is already ON' }, { quoted: fake });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? 'Antilink has been turned ON' : 'Failed to turn ON Antilink' 
                }, { quoted: fake });
                break;
            }

            case 'off': {
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, { text: 'Antilink has been turned OFF' }, { quoted: fake });
                break;
            }

            case 'set': {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please specify an action: .antilink set delete | kick | warn' 
                    }, { quoted: fake });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, { text: 'Invalid action. Choose delete, kick, or warn.' }, { quoted: fake });
                    return;
                }

                const currentConfig = await getAntilink(chatId, 'on') || {};
                const updatedConfig = {
                    ...currentConfig,
                    action: setAction,
                    enabled: currentConfig.enabled || true
                };

                const setResult = await setAntilink(chatId, 'on', setAction);
                if (setResult) {
                    if (currentConfig.allowedLinks) {
                        console.log('Preserving allowed links:', currentConfig.allowedLinks);
                    }
                }

                await sock.sendMessage(chatId, { 
                    text: setResult ? `Antilink action set to ${setAction}` : 'Failed to set Antilink action' 
                }, { quoted: fake });
                break;
            }

            case 'get': {
                const config = await getAntilink(chatId, 'on');
                if (!config) {
                    await sock.sendMessage(chatId, { 
                        text: 'Antilink Configuration:\nStatus: OFF\nAction: Not set\nAllowed Links: 0' 
                    }, { quoted: fake });
                    return;
                }

                let statusText = `Antilink Configuration:\n`;
                statusText += `Status: ${config.enabled ? 'ON' : 'OFF'}\n`;
                statusText += `Action: ${config.action || 'Not set'}\n`;
                statusText += `Allowed Links: ${config.allowedLinks?.length || 0}\n`;

                if (config.allowedLinks?.length > 0) {
                    statusText += `\nAllowed Links:\n`;
                    statusText += config.allowedLinks.map((link, i) => `${i + 1}. ${link}`).join('\n');
                }

                await sock.sendMessage(chatId, { text: statusText }, { quoted: fake });
                break;
            }

            case 'allow': {
                const link = args.slice(1).join(' ');
                if (!link) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please specify a link: .antilink allow [link]' 
                    }, { quoted: fake });
                    return;
                }

                const config = await getAntilink(chatId, 'on');
                if (!config?.enabled) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please enable antilink first: .antilink on' 
                    }, { quoted: fake });
                    return;
                }

                let cleanLink;
                try {
                    const url = new URL(link.startsWith('http') ? link : `https://${link}`);
                    cleanLink = url.hostname + url.pathname;
                    if (cleanLink.endsWith('/')) cleanLink = cleanLink.slice(0, -1);
                } catch {
                    cleanLink = link.trim().toLowerCase();
                }

                if (!config.allowedLinks) config.allowedLinks = [];

                if (config.allowedLinks.includes(cleanLink)) {
                    await sock.sendMessage(chatId, { text: `Link already allowed: ${cleanLink}` }, { quoted: fake });
                    return;
                }

                config.allowedLinks.push(cleanLink);
                const allowResult = await setAntilink(chatId, 'allowed', config.allowedLinks);

                await sock.sendMessage(chatId, { 
                    text: allowResult ? 
                        `Link allowed: ${cleanLink}\nUsers can now post links containing this pattern.` : 
                        'Failed to allow link'
                }, { quoted: fake });
                break;
            }

            case 'disallow':
            case 'remove': {
                const link = args.slice(1).join(' ');
                if (!link) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please specify a link: .antilink disallow [link]' 
                    }, { quoted: fake });
                    return;
                }

                const config = await getAntilink(chatId, 'on');
                if (!config?.allowedLinks || config.allowedLinks.length === 0) {
                    await sock.sendMessage(chatId, { text: 'No allowed links to remove' }, { quoted: fake });
                    return;
                }

                const index = config.allowedLinks.findIndex(allowed => 
                    allowed.toLowerCase().includes(link.toLowerCase()) || 
                    link.toLowerCase().includes(allowed.toLowerCase())
                );

                if (index === -1) {
                    await sock.sendMessage(chatId, { text: `Link not found in allowed list: ${link}` }, { quoted: fake });
                    return;
                }

                const removedLink = config.allowedLinks.splice(index, 1)[0];
                const disallowResult = await setAntilink(chatId, 'allowed', config.allowedLinks);

                await sock.sendMessage(chatId, { 
                    text: disallowResult ? 
                        `Link removed from allowed list: ${removedLink}` : 
                        'Failed to remove link'
                }, { quoted: fake });
                break;
            }

            case 'help':
                const helpText = `Antilink Commands\n\n` +
                               `.antilink on - Enable antilink\n` +
                               `.antilink set [delete|kick|warn] - Set action mode\n` +
                               `.antilink off - Disable antilink\n` +
                               `.antilink allow [link] - Allow specific link\n` +
                               `.antilink disallow [link] - Remove allowed link\n` +
                               `.antilink get - Show current settings\n` +
                               `.antilink help - Show this help\n\n` +
                               `Action Modes:\n` +
                               `delete - Remove link messages\n` +
                               `warn - Warn the user\n` +
                               `kick - Remove user from group`;
                await sock.sendMessage(chatId, { text: helpText }, { quoted: fake });
                break;

            default:
                await sock.sendMessage(chatId, { text: 'Invalid command. Use .antilink help for usage.' }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antilink command:', error);
        const fake = createFakeContact({ key: { participant: senderId, remoteJid: chatId } });
        await sock.sendMessage(chatId, { text: 'Error processing antilink command' }, { quoted: fake });
    }
}

/**
 * Handle Link Detection
 */
async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    const antilinkConfig = await getAntilink(chatId, 'on');
    if (!antilinkConfig?.enabled) return;

    console.log(`Antilink Setting for ${chatId}: ${antilinkConfig.action}`);
    console.log(`Checking message for links: ${userMessage}`);

    const senderIsAdmin = await isAdmin(sock, chatId, senderId);
    if (senderIsAdmin) {
        console.log(`Sender ${senderId} is an admin. Skipping antilink enforcement.`);
        return;
    }

    if (!containsLink(userMessage)) {
        console.log('No link detected.');
        return;
    }

    const allowedConfig = await getAntilink(chatId, 'allowed') || [];
    const allowedLinks = Array.isArray(allowedConfig) ? allowedConfig : [];

    if (allowedLinks.length > 0) {
        const cleanText = userMessage.toLowerCase();
        const isAllowed = allowedLinks.some(allowedLink => 
            cleanText.includes(allowedLink.toLowerCase())
        );
        if (isAllowed) {
            console.log(`Link allowed for pattern in message from ${senderId}`);
            return;
        }
    }

    const quotedMessageId = message.key.id;
    const quotedParticipant = message.key.participant || senderId;

    try {
        if (antilinkConfig.action === 'delete') {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: quotedMessageId, participant: quotedParticipant },
            });
            console.log(`Message with ID ${quotedMessageId} deleted successfully.`);
        } else if (antilinkConfig.action === 'kick') {
            await enforce(sock, chatId, senderId, message, 'kick');
        } else if (antilinkConfig.action === 'warn') {
            await enforce(sock, chatId, senderId, message, 'warn');
        }
    } catch (error) {
        console.error('Failed to enforce antilink action:', error);
    }
}

// Real-time listener setup
let isListenerSetup = false;

function setupAntiLinkListener(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg || msg.key.fromMe || !msg.key.remoteJid?.endsWith('@g.us')) return;

            const chatId = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;

            if (!sender) return;

            const antilinkConfig = await getAntilink(chatId, 'on');
            if (!antilinkConfig?.enabled) return;

            const text =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                msg.message?.documentMessage?.caption || '';

            if (!containsLink(text)) return;

            try {
                const senderIsAdmin = await isAdmin(sock, chatId, sender);
                if (senderIsAdmin) {
                    console.log(`Sender ${sender} is an admin. Skipping antilink enforcement.`);
                    return;
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
            }

            const allowedConfig = await getAntilink(chatId, 'allowed') || [];
            const allowedLinks = Array.isArray(allowedConfig) ? allowedConfig : [];

            if (allowedLinks.length > 0) {
                const cleanText = text.toLowerCase();
                const isAllowed = allowedLinks.some(allowedLink => 
                    cleanText.includes(allowedLink.toLowerCase())
                );
                if (isAllowed) {
                    console.log(`Link allowed for pattern in message from ${sender}`);
                    return;
                }
            }

            const result = await enforce(sock, chatId, sender, msg, antilinkConfig.action);

            if (!result.success) {
                console.error(`Failed to enforce ${antilinkConfig.action} mode:`, result.error);
            }

        } catch (error) {
            console.error('Error in anti-link listener:', error);
        }
    });
}

function initializeAntiLink(sock) {
    if (!isListenerSetup) {
        setupAntiLinkListener(sock);
        isListenerSetup = true;
        console.log('Anti-link listener initialized');
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection,
    initializeAntiLink
};