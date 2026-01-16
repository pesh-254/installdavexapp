const { setAntitag, getAntitag, removeAntitag } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');

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

// Store for counting detected tagall messages
const antitagStats = new Map();

async function handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        const fake = createFakeContact(message);
        
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: 'For Group Admins Only' }, { quoted: fake });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage = `ANTITAG SETUP\n\n${prefix}antitag on\n${prefix}antitag set delete | kick\n${prefix}antitag off\n${prefix}antitag stats`;
            await sock.sendMessage(chatId, { text: usage }, { quoted: fake });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntitag(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: 'Antitag is already on' }, { quoted: fake });
                    return;
                }
                const result = await setAntitag(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, { 
                    text: result ? 'Antitag has been turned ON' : 'Failed to turn on Antitag' 
                }, { quoted: fake });
                break;

            case 'off':
                await removeAntitag(chatId, 'on');
                await sock.sendMessage(chatId, { text: 'Antitag has been turned OFF' }, { quoted: fake });
                break;

            case 'set':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: `Please specify an action: ${prefix}antitag set delete | kick` 
                    }, { quoted: fake });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick'].includes(setAction)) {
                    await sock.sendMessage(chatId, { 
                        text: 'Invalid action. Choose delete or kick.' 
                    }, { quoted: fake });
                    return;
                }
                const setResult = await setAntitag(chatId, 'on', setAction);
                await sock.sendMessage(chatId, { 
                    text: setResult ? `Antitag action set to ${setAction}` : 'Failed to set Antitag action' 
                }, { quoted: fake });
                break;

            case 'get':
                const status = await getAntitag(chatId, 'on');
                await sock.sendMessage(chatId, { 
                    text: `Antitag Configuration:\nStatus: ${status?.enabled ? 'ON' : 'OFF'}\nAction: ${status?.action || 'delete'}\nTotal Detected: ${getGroupStats(chatId) || 0} messages` 
                }, { quoted: fake });
                break;

            case 'stats':
            case 'info':
                const config = await getAntitag(chatId, 'on');
                const stats = getGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: `ANTITAG STATISTICS\n\nStatus: ${config?.enabled ? 'ON' : 'OFF'}\nAction: ${config?.action || 'delete'}\nTotal Detected: ${stats || 0} messages\nLast Reset: ${getLastResetTime(chatId)}` 
                }, { quoted: fake });
                break;

            case 'reset':
            case 'clear':
                resetGroupStats(chatId);
                await sock.sendMessage(chatId, { 
                    text: 'Antitag statistics have been reset' 
                }, { quoted: fake });
                break;

            default:
                await sock.sendMessage(chatId, { text: `Use ${prefix}antitag for usage.` }, { quoted: fake });
        }
    } catch (error) {
        console.error('Error in antitag command:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { text: 'Error processing antitag command' }, { quoted: fake });
    }
}

async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        if (!chatId.endsWith('@g.us')) return;

        const antitagSetting = await getAntitag(chatId, 'on');
        if (!antitagSetting || !antitagSetting.enabled) return;

        let groupMetadata;
        let totalParticipants = 0;
        
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        let messageText = '';
        const msg = message.message;
        if (msg.conversation) {
            messageText = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
            messageText = msg.extendedTextMessage.text;
        } else if (msg.imageMessage?.caption) {
            messageText = msg.imageMessage.caption;
        } else if (msg.videoMessage?.caption) {
            messageText = msg.videoMessage.caption;
        } else if (msg.documentMessage?.caption) {
            messageText = msg.documentMessage.caption;
        }

        if (!messageText && mentionedJids.length === 0) return;

        const textMentions = messageText.match(/@[\d\s\-().]+/g) || [];
        const numericMentions = messageText.match(/@\d{8,}/g) || [];
        
        const uniqueMentions = new Set();
        
        for (const jid of mentionedJids) {
            if (jid && jid.includes('@s.whatsapp.net')) {
                uniqueMentions.add(jid.split('@')[0]);
            }
        }
        
        for (const mention of textMentions) {
            const cleanMention = mention.replace(/@/g, '').replace(/[^\d]/g, '');
            if (cleanMention.length >= 8) {
                uniqueMentions.add(cleanMention);
            }
        }
        
        for (const mention of numericMentions) {
            const numMatch = mention.match(/@(\d+)/);
            if (numMatch) uniqueMentions.add(numMatch[1]);
        }

        const totalUniqueMentions = uniqueMentions.size;

        if (totalUniqueMentions >= 3) {
            if (!groupMetadata) {
                groupMetadata = await sock.groupMetadata(chatId);
                totalParticipants = groupMetadata.participants?.length || 0;
            }
            
            let mentionThreshold;
            if (totalParticipants <= 10) mentionThreshold = 3;
            else if (totalParticipants <= 30) mentionThreshold = Math.max(3, Math.ceil(totalParticipants * 0.3));
            else mentionThreshold = Math.max(5, Math.ceil(totalParticipants * 0.25));

            const hasMassMentions = totalUniqueMentions >= mentionThreshold;
            const hasManyNumericMentions = numericMentions.length >= 5;
            const hasExcessiveMentions = totalUniqueMentions >= 10;

            if (hasMassMentions || hasManyNumericMentions || hasExcessiveMentions) {
                incrementGroupStats(chatId);
                
                const action = antitagSetting.action || 'delete';
                const stats = getGroupStats(chatId);
                const fake = createFakeContact(message);
                
                const actions = [];
                
                actions.push(
                    sock.sendMessage(chatId, {
                        delete: {
                            remoteJid: chatId,
                            fromMe: false,
                            id: message.key.id,
                            participant: senderId
                        }
                    }).catch(err => console.error('Delete failed:', err))
                );

                if (action === 'kick') {
                    actions.push(
                        sock.groupParticipantsUpdate(chatId, [senderId], "remove")
                            .then(() => {
                                return sock.sendMessage(chatId, {
                                    text: `Antitag Detected!\n\nMentions: ${totalUniqueMentions} users\nUser: @${senderId.split('@')[0]}\nTotal Detected: ${stats} messages\nAction: User kicked`,
                                    mentions: [senderId]
                                }, { quoted: fake });
                            })
                            .catch(kickError => {
                                console.error('Kick failed:', kickError);
                                return sock.sendMessage(chatId, {
                                    text: 'Tagall Detected! Failed to kick user. Message was deleted.'
                                }, { quoted: fake });
                            })
                    );
                } else {
                    actions.push(
                        sock.sendMessage(chatId, {
                            text: `Tagall Detected!\n\nMentions: ${totalUniqueMentions} users\nTotal Detected: ${stats} messages\nAction: Message deleted`
                        }, { quoted: fake })
                    );
                }

                await Promise.allSettled(actions);
                
                console.log(`[ANTITAG] Group: ${chatId}, Mentions: ${totalUniqueMentions}, Action: ${action}, Total: ${stats}`);
            }
        }
    } catch (error) {
        console.error('Error in tag detection:', error);
    }
}

// Statistics management functions
function incrementGroupStats(chatId) {
    const stats = antitagStats.get(chatId) || { count: 0, lastReset: new Date() };
    stats.count++;
    antitagStats.set(chatId, stats);
}

function getGroupStats(chatId) {
    const stats = antitagStats.get(chatId);
    return stats ? stats.count : 0;
}

function resetGroupStats(chatId) {
    antitagStats.set(chatId, { count: 0, lastReset: new Date() });
}

function getLastResetTime(chatId) {
    const stats = antitagStats.get(chatId);
    return stats ? stats.lastReset.toLocaleString() : 'Never';
}

// Export functions for external access
function getAllAntitagStats() {
    const stats = {};
    antitagStats.forEach((value, key) => {
        stats[key] = value;
    });
    return stats;
}

module.exports = {
    handleAntitagCommand,
    handleTagDetection,
    getGroupStats,
    resetGroupStats,
    getAllAntitagStats
};