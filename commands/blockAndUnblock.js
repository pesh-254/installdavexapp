const isAdmin = require('../lib/isAdmin');

async function blockAndUnblockCommand(sock, chatId, message, msg, senderId) {
    try {
        // Verify admin privileges
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isSenderAdmin && !isBotAdmin) {
            return sock.sendMessage(chatId, { text: '❌ Only admins can use block/unblock commands.' });
        }

        const args = message.trim().split(/\s+/);
        const command = args[0]?.toLowerCase();

        // Helper: block/unblock a single JID
        const handleBlockStatus = async (jid, action, context = '') => {
            if (!jid.endsWith('@s.whatsapp.net')) throw new Error('Invalid JID format');
            await sock.updateBlockStatus(jid, action);
            const phoneNumber = jid.split('@')[0];
            return `✅ Successfully ${action}ed ${context}${phoneNumber}`;
        };

        // Helper: extract mentioned or replied JIDs
        const getTargetJids = () => {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            if (!contextInfo) return [];
            if (contextInfo.mentionedJid?.length) return contextInfo.mentionedJid;
            if (contextInfo.participant) return [contextInfo.participant];
            return [];
        };

        switch (command) {
            case '!block':
            case '!unblock': {
                const action = command === '!block' ? 'block' : 'unblock';
                const jids = getTargetJids();

                if (jids.length) {
                    for (const jid of jids) {
                        const result = await handleBlockStatus(jid, action, jids.length > 1 ? 'mentioned user ' : 'replied user ');
                        await sock.sendMessage(chatId, { text: result });
                    }
                    return;
                }

                if (args.length < 2) {
                    return sock.sendMessage(chatId, {
                        text: `📋 *Usage:*\n\n` +
                              `• ${command} <phone_number>\n` +
                              `• ${command} (reply to a message)\n` +
                              `• ${command} @mention\n\n` +
                              `📝 *Example:* ${command} 1234567890`
                    });
                }

                const phone = args[1].replace(/\D/g, '');
                if (phone.length < 10) throw new Error('Invalid phone number. Must be at least 10 digits.');

                const jid = `${phone}@s.whatsapp.net`;
                const result = await handleBlockStatus(jid, action);
                await sock.sendMessage(chatId, { text: result });
                break;
            }

            case '!blocklist': {
                const blockedContacts = await sock.fetchBlocklist();
                if (!blockedContacts?.length) {
                    return sock.sendMessage(chatId, { text: '📭 *Blocklist is Empty*\n\nNo contacts are currently blocked.' });
                }

                const blocklistMessage = [
                    '📋 *BLOCKED CONTACTS*\n',
                    ...blockedContacts.map((jid, i) => `${String(i + 1).padStart(2, '0')}. ${jid.split('@')[0]}`),
                    `\n📊 *Total Blocked:* ${blockedContacts.length}`
                ].join('\n');

                await sock.sendMessage(chatId, { text: blocklistMessage });
                break;
            }

            default: {
                const helpMessage = `🔒 *Block/Unblock Commands*\n\n` +
                    `• !block <number> - Block by phone number\n` +
                    `• !block (reply) - Block replied user\n` +
                    `• !block @mention - Block mentioned user\n` +
                    `• !unblock <number> - Unblock by phone number\n` +
                    `• !unblock (reply) - Unblock replied user\n` +
                    `• !unblock @mention - Unblock mentioned user\n` +
                    `• !blocklist - View all blocked contacts\n\n` +
                    `📝 *Examples:*\n` +
                    `→ Reply: "!block" (reply to a message)\n` +
                    `→ Mention: "!block @user"\n` +
                    `→ Phone: "!block 1234567890"`;

                await sock.sendMessage(chatId, { text: helpMessage });
            }
        }
    } catch (error) {
        console.error('Error in block/unblock command:', error);

        const errorMap = {
            'Invalid JID': 'Invalid contact format.',
            'Invalid phone number': 'Please provide a valid phone number.',
            'not authorized': 'You are not authorized to perform this action.',
            'not found': 'Contact not found.',
            'bad request': 'Invalid contact format.'
        };

        const matchedError = Object.entries(errorMap).find(([key]) => error.message?.includes(key));
        const errorMessage = `❌ Failed to process command. ${matchedError ? matchedError[1] : 'Please try again later.'}`;

        await sock.sendMessage(chatId, { text: errorMessage });
    }
}

module.exports = blockAndUnblockCommand;
