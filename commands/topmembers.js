const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'messageCount.json');

function ensureDataDirectory() {
    const dataDir = path.dirname(dataFilePath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function loadMessageCounts() {
    try {
        ensureDataDirectory();
        if (fs.existsSync(dataFilePath)) {
            const data = fs.readFileSync(dataFilePath, 'utf8');
            if (!data.trim()) {
                return {};
            }
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('Error loading message counts:', error);
        return {};
    }
}

function saveMessageCounts(messageCounts) {
    try {
        ensureDataDirectory();
        fs.writeFileSync(dataFilePath, JSON.stringify(messageCounts, null, 2));
    } catch (error) {
        console.error('Error saving message counts:', error);
    }
}

function incrementMessageCount(groupId, userId) {
    try {
        const messageCounts = loadMessageCounts();

        if (!messageCounts[groupId]) {
            messageCounts[groupId] = {};
        }

        if (!messageCounts[groupId][userId]) {
            messageCounts[groupId][userId] = 0;
        }

        messageCounts[groupId][userId] += 1;

        saveMessageCounts(messageCounts);
    } catch (error) {
        console.error('Error incrementing message count:', error);
    }
}

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "Davex Stats",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Stats;;;\nFN:Davex Statistics\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Stats Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function topMembers(sock, chatId, isGroup, message, count = 5) {
    const fakeContact = createFakeContact(message);
    
    try {
        if (!isGroup) {
            sock.sendMessage(chatId, { text: 'Group context required' }, { quoted: fakeContact });
            return;
        }

        const messageCounts = loadMessageCounts();
        const groupCounts = messageCounts[chatId] || {};

        const sortedMembers = Object.entries(groupCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, count);

        if (sortedMembers.length === 0) {
            sock.sendMessage(chatId, { text: 'No interaction data available' }, { quoted: fakeContact });
            return;
        }

        let textContent = `PARTICIPANT ACTIVITY LEADERS\n\n`;
        const mentions = [];

        sortedMembers.forEach(([userId, messageCount], index) => {
            const rankMarkers = ['A', 'B', 'C', 'D', 'E'];
            const rankMarker = rankMarkers[index] || (index + 1);
            const username = userId.split('@')[0];

            textContent += `${rankMarker}. ${username} - ${messageCount} interactions\n`;
            mentions.push(userId);
        });

        const totalMessages = Object.values(groupCounts).reduce((sum, count) => sum + count, 0);
        textContent += `\nTotal group interactions: ${totalMessages}`;

        sock.sendMessage(chatId, { 
            text: textContent, 
            mentions: mentions 
        }, { quoted: fakeContact });
    } catch (error) {
        console.error('Error in topMembers command:', error);
        sock.sendMessage(chatId, { text: 'Leaderboard retrieval error' }, { quoted: fakeContact });
    }
}

async function getUserRank(sock, chatId, isGroup, userId, message) {
    const fakeContact = createFakeContact(message);
    
    try {
        if (!isGroup) {
            sock.sendMessage(chatId, { text: 'Group context required' }, { quoted: fakeContact });
            return;
        }

        const messageCounts = loadMessageCounts();
        const groupCounts = messageCounts[chatId] || {};

        if (!groupCounts[userId]) {
            sock.sendMessage(chatId, { text: 'No interaction history for user' }, { quoted: fakeContact });
            return;
        }

        const sortedMembers = Object.entries(groupCounts)
            .sort(([, a], [, b]) => b - a);

        const userRank = sortedMembers.findIndex(([id]) => id === userId) + 1;
        const userMessageCount = groupCounts[userId];
        const totalMembers = sortedMembers.length;

        const textContent = `USER INTERACTION METRICS\n\n` +
                       `Position: ${userRank} of ${totalMembers}\n` +
                       `Interaction count: ${userMessageCount}\n` +
                       `Percentile: ${Math.round((userRank / totalMembers) * 100)}%`;

        sock.sendMessage(chatId, { text: textContent, mentions: [userId] }, { quoted: fakeContact });
    } catch (error) {
        console.error('Error in getUserRank command:', error);
        sock.sendMessage(chatId, { text: 'User metric retrieval error' }, { quoted: fakeContact });
    }
}

function resetMessageCounts(groupId) {
    try {
        const messageCounts = loadMessageCounts();
        if (messageCounts[groupId]) {
            delete messageCounts[groupId];
            saveMessageCounts(messageCounts);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error resetting message counts:', error);
        return false;
    }
}

async function getGroupStats(sock, chatId, isGroup, message) {
    const fakeContact = createFakeContact(message);
    
    try {
        if (!isGroup) {
            sock.sendMessage(chatId, { text: 'Group context required' }, { quoted: fakeContact });
            return;
        }

        const messageCounts = loadMessageCounts();
        const groupCounts = messageCounts[chatId] || {};

        const totalMessages = Object.values(groupCounts).reduce((sum, count) => sum + count, 0);
        const activeMembers = Object.keys(groupCounts).length;

        const sortedCounts = Object.values(groupCounts).sort((a, b) => b - a);
        const averageMessages = activeMembers > 0 ? Math.round(totalMessages / activeMembers) : 0;

        let textContent = `GROUP INTERACTION STATISTICS\n\n` +
                     `Active participants: ${activeMembers}\n` +
                     `Total interactions: ${totalMessages}\n` +
                     `Average per participant: ${averageMessages}\n` +
                     `Maximum individual: ${sortedCounts[0] || 0}`;

        sock.sendMessage(chatId, { text: textContent }, { quoted: fakeContact });
    } catch (error) {
        console.error('Error in getGroupStats command:', error);
        sock.sendMessage(chatId, { text: 'Statistical data retrieval error' }, { quoted: fakeContact });
    }
}

module.exports = { 
    incrementMessageCount, 
    topMembers, 
    getUserRank, 
    resetMessageCounts,
    getGroupStats,
    createFakeContact 
};