const fs = require('fs');
const path = require('path');

// Function to load user and group data from JSON file
function loadUserGroupData() {
    try {
        const dataPath = path.join(__dirname, '../data/userGroupData.json');
        if (!fs.existsSync(dataPath)) {
            // Create the file with default structure if it doesn't exist
            const defaultData = {
                antibadword: {},
                antilink: {},
                antitag: {},
                antigroupmention: {},
                antidemote: {},
                antisticker: {},
                antiimage: {},
                antiaudio: {},
                antidocument: {},
                antifiles: {},
                antipromote: {},
                antivideo: {},
                antibug: {},
                welcome: {},
                goodbye: {},
                chatbot: {},
                warnings: {},
                sudo: []
            };
            fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        return data;
    } catch (error) {
        console.error('Error loading user group data:', error);
        return {
            antibadword: {},
            antilink: {},
            antitag: {},
            antigroupmention: {},
            antidemote: {},
            antisticker: {},
            antiimage: {},
            antiaudio: {},
            antidocument: {},
            antifiles: {},
            antipromote: {},
            antivideo: {},
            antibug: {},
            welcome: {},
            goodbye: {},
            chatbot: {},
            warnings: {},
            sudo: []
        };
    }
}

// Function to save user and group data to JSON file
function saveUserGroupData(data) {
    try {
        const dataPath = path.join(__dirname, '../data/userGroupData.json');
        // Ensure the directory exists
        const dir = path.dirname(dataPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving user group data:', error);
        return false;
    }
}

// ==================== ANTIFEAUTURE FUNCTIONS ====================

// Antilink functions
async function setAntilink(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antilink) data.antilink = {};
        data.antilink[groupId] = {
            enabled: type === 'on',
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antilink:', error);
        return false;
    }
}

async function getAntilink(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antilink || !data.antilink[groupId]) return null;
        return type === 'on' ? data.antilink[groupId] : null;
    } catch (error) {
        console.error('Error getting antilink:', error);
        return null;
    }
}

async function removeAntilink(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antilink && data.antilink[groupId]) {
            delete data.antilink[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antilink:', error);
        return false;
    }
}

// Antitag functions
async function setAntitag(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antitag) data.antitag = {};
        data.antitag[groupId] = {
            enabled: type === 'on',
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antitag:', error);
        return false;
    }
}

async function getAntitag(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antitag || !data.antitag[groupId]) return null;
        return type === 'on' ? data.antitag[groupId] : null;
    } catch (error) {
        console.error('Error getting antitag:', error);
        return null;
    }
}

async function removeAntitag(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antitag && data.antitag[groupId]) {
            delete data.antitag[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antitag:', error);
        return false;
    }
}

// Antigroupmention functions
async function setAntigroupmention(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antigroupmention) data.antigroupmention = {};
        data.antigroupmention[groupId] = {
            enabled: type === 'on',
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antigroupmention:', error);
        return false;
    }
}

async function getAntigroupmention(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antigroupmention || !data.antigroupmention[groupId]) return null;
        return type === 'on' ? data.antigroupmention[groupId] : null;
    } catch (error) {
        console.error('Error getting antigroupmention:', error);
        return null;
    }
}

async function removeAntigroupmention(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antigroupmention && data.antigroupmention[groupId]) {
            delete data.antigroupmention[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antigroupmention:', error);
        return false;
    }
}

// Antidemote functions
async function setAntidemote(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antidemote) data.antidemote = {};
        data.antidemote[groupId] = {
            enabled: type === 'on' || type === true
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antidemote:', error);
        return false;
    }
}

async function getAntidemote(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antidemote || !data.antidemote[groupId]) return { enabled: false };
        return data.antidemote[groupId];
    } catch (error) {
        console.error('Error getting antidemote:', error);
        return { enabled: false };
    }
}

async function removeAntidemote(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antidemote && data.antidemote[groupId]) {
            delete data.antidemote[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antidemote:', error);
        return false;
    }
}

// Antisticker functions
async function setAntisticker(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antisticker) data.antisticker = {};
        data.antisticker[groupId] = {
            enabled: type === 'on' || type === true,
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antisticker:', error);
        return false;
    }
}

async function getAntisticker(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antisticker || !data.antisticker[groupId]) return { enabled: false, action: 'delete' };
        return data.antisticker[groupId];
    } catch (error) {
        console.error('Error getting antisticker:', error);
        return { enabled: false, action: 'delete' };
    }
}

async function removeAntisticker(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antisticker && data.antisticker[groupId]) {
            delete data.antisticker[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antisticker:', error);
        return false;
    }
}

// Antiimage functions
async function setAntiimage(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antiimage) data.antiimage = {};
        data.antiimage[groupId] = {
            enabled: type === 'on' || type === true,
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antiimage:', error);
        return false;
    }
}

async function getAntiimage(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antiimage || !data.antiimage[groupId]) return { enabled: false, action: 'delete' };
        return data.antiimage[groupId];
    } catch (error) {
        console.error('Error getting antiimage:', error);
        return { enabled: false, action: 'delete' };
    }
}

async function removeAntiimage(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antiimage && data.antiimage[groupId]) {
            delete data.antiimage[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antiimage:', error);
        return false;
    }
}

// Antiaudio functions
async function setAntiaudio(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antiaudio) data.antiaudio = {};
        data.antiaudio[groupId] = {
            enabled: type === 'on' || type === true,
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antiaudio:', error);
        return false;
    }
}

async function getAntiaudio(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antiaudio || !data.antiaudio[groupId]) return { enabled: false, action: 'delete' };
        return data.antiaudio[groupId];
    } catch (error) {
        console.error('Error getting antiaudio:', error);
        return { enabled: false, action: 'delete' };
    }
}

async function removeAntiaudio(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antiaudio && data.antiaudio[groupId]) {
            delete data.antiaudio[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antiaudio:', error);
        return false;
    }
}

// Antidocument functions
async function setAntidocument(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antidocument) data.antidocument = {};
        data.antidocument[groupId] = {
            enabled: type === 'on' || type === true,
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antidocument:', error);
        return false;
    }
}

async function getAntidocument(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antidocument || !data.antidocument[groupId]) return { enabled: false, action: 'delete' };
        return data.antidocument[groupId];
    } catch (error) {
        console.error('Error getting antidocument:', error);
        return { enabled: false, action: 'delete' };
    }
}

async function removeAntidocument(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antidocument && data.antidocument[groupId]) {
            delete data.antidocument[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antidocument:', error);
        return false;
    }
}

// Antifiles functions (blocks all files)
async function setAntifiles(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antifiles) data.antifiles = {};
        data.antifiles[groupId] = {
            enabled: type === 'on' || type === true,
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antifiles:', error);
        return false;
    }
}

async function getAntifiles(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antifiles || !data.antifiles[groupId]) return { enabled: false, action: 'delete' };
        return data.antifiles[groupId];
    } catch (error) {
        console.error('Error getting antifiles:', error);
        return { enabled: false, action: 'delete' };
    }
}

async function removeAntifiles(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antifiles && data.antifiles[groupId]) {
            delete data.antifiles[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antifiles:', error);
        return false;
    }
}

// Antipromote functions
async function setAntipromote(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antipromote) data.antipromote = {};
        data.antipromote[groupId] = {
            enabled: type === 'on' || type === true
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antipromote:', error);
        return false;
    }
}

async function getAntipromote(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antipromote || !data.antipromote[groupId]) return { enabled: false };
        return data.antipromote[groupId];
    } catch (error) {
        console.error('Error getting antipromote:', error);
        return { enabled: false };
    }
}

async function removeAntipromote(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antipromote && data.antipromote[groupId]) {
            delete data.antipromote[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antipromote:', error);
        return false;
    }
}

// Antivideo functions
async function setAntivideo(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antivideo) data.antivideo = {};
        data.antivideo[groupId] = {
            enabled: type === 'on' || type === true,
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antivideo:', error);
        return false;
    }
}

async function getAntivideo(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antivideo || !data.antivideo[groupId]) return { enabled: false, action: 'delete' };
        return data.antivideo[groupId];
    } catch (error) {
        console.error('Error getting antivideo:', error);
        return { enabled: false, action: 'delete' };
    }
}

async function removeAntivideo(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antivideo && data.antivideo[groupId]) {
            delete data.antivideo[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antivideo:', error);
        return false;
    }
}

// Antibug functions
async function setAntibug(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antibug) data.antibug = {};
        data.antibug[groupId] = {
            enabled: type === 'on' || type === true,
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antibug:', error);
        return false;
    }
}

async function getAntibug(groupId) {
    try {
        const data = loadUserGroupData();
        if (!data.antibug || !data.antibug[groupId]) return { enabled: false, action: 'delete' };
        return data.antibug[groupId];
    } catch (error) {
        console.error('Error getting antibug:', error);
        return { enabled: false, action: 'delete' };
    }
}

async function removeAntibug(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.antibug && data.antibug[groupId]) {
            delete data.antibug[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antibug:', error);
        return false;
    }
}

// Antibadword functions
async function setAntiBadword(groupId, type, action) {
    try {
        const data = loadUserGroupData();
        if (!data.antibadword) data.antibadword = {};
        data.antibadword[groupId] = {
            enabled: type === 'on',
            action: action || 'delete'
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting antibadword:', error);
        return false;
    }
}

async function getAntiBadword(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (!data.antibadword || !data.antibadword[groupId]) return null;
        const config = data.antibadword[groupId];
        return type === 'on' ? config : null;
    } catch (error) {
        console.error('Error getting antibadword:', error);
        return null;
    }
}

async function removeAntiBadword(groupId, type) {
    try {
        const data = loadUserGroupData();
        if (data.antibadword && data.antibadword[groupId]) {
            delete data.antibadword[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing antibadword:', error);
        return false;
    }
}

// Chatbot functions
async function setChatbot(groupId, enabled) {
    try {
        const data = loadUserGroupData();
        if (!data.chatbot) data.chatbot = {};
        data.chatbot[groupId] = {
            enabled: enabled
        };
        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error setting chatbot:', error);
        return false;
    }
}

async function getChatbot(groupId) {
    try {
        const data = loadUserGroupData();
        return data.chatbot?.[groupId] || null;
    } catch (error) {
        console.error('Error getting chatbot:', error);
        return null;
    }
}

async function removeChatbot(groupId) {
    try {
        const data = loadUserGroupData();
        if (data.chatbot && data.chatbot[groupId]) {
            delete data.chatbot[groupId];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing chatbot:', error);
        return false;
    }
}

// ==================== WARNING SYSTEM ====================
async function incrementWarningCount(groupId, userId) {
    try {
        const data = loadUserGroupData();
        if (!data.warnings) data.warnings = {};
        if (!data.warnings[groupId]) data.warnings[groupId] = {};
        if (!data.warnings[groupId][userId]) data.warnings[groupId][userId] = 0;

        data.warnings[groupId][userId]++;
        saveUserGroupData(data);
        return data.warnings[groupId][userId];
    } catch (error) {
        console.error('Error incrementing warning count:', error);
        return 0;
    }
}

async function resetWarningCount(groupId, userId) {
    try {
        const data = loadUserGroupData();
        if (data.warnings && data.warnings[groupId] && data.warnings[groupId][userId]) {
            data.warnings[groupId][userId] = 0;
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error resetting warning count:', error);
        return false;
    }
}

// ==================== SUDO MANAGEMENT ====================
async function isSudo(userId) {
    try {
        const data = loadUserGroupData();

        if (!data.sudo || !Array.isArray(data.sudo)) {
            return false;
        }

        // Direct match
        if (data.sudo.includes(userId)) {
            return true;
        }

        // Handle LID format
        const settings = require('../settings');
        const ownerNumber = settings.ownerNumber;

        for (const sudoEntry of data.sudo) {
            if (sudoEntry && sudoEntry.includes(ownerNumber)) {
                if (userId && userId.includes(ownerNumber)) {
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        console.error('Error checking sudo:', error);
        return false;
    }
}

async function addSudo(userJid) {
    try {
        const data = loadUserGroupData();
        if (!data.sudo) data.sudo = [];
        if (!data.sudo.includes(userJid)) {
            data.sudo.push(userJid);
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error adding sudo:', error);
        return false;
    }
}

async function removeSudo(userJid) {
    try {
        const data = loadUserGroupData();
        if (!data.sudo) data.sudo = [];
        const idx = data.sudo.indexOf(userJid);
        if (idx !== -1) {
            data.sudo.splice(idx, 1);
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error removing sudo:', error);
        return false;
    }
}

async function getSudoList() {
    try {
        const data = loadUserGroupData();
        return Array.isArray(data.sudo) ? data.sudo : [];
    } catch (error) {
        console.error('Error getting sudo list:', error);
        return [];
    }
}

// ==================== WELCOME/GOODBYE ====================
async function addWelcome(jid, enabled, message) {
    try {
        const data = loadUserGroupData();
        if (!data.welcome) data.welcome = {};

        data.welcome[jid] = {
            enabled: enabled,
            message: message || `┌─❖
│「 𝗛𝗶 👋 」
└┬❖ 「  {user}  」
   │✑  𝗪𝗲𝗹𝗰𝗼𝗺𝗲 𝘁𝗼 
   │✑  {group}
   │✑  𝗠𝗲𝗺𝗯𝗲𝗿 : 
   │✑ Welcome  thanks for joining 🎉
   └───────────────┈ ⳹
      `,
            channelId: '@newsletter'
        };

        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error in addWelcome:', error);
        return false;
    }
}

async function delWelcome(jid) {
    try {
        const data = loadUserGroupData();
        if (data.welcome && data.welcome[jid]) {
            delete data.welcome[jid];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error in delWelcome:', error);
        return false;
    }
}

async function isWelcomeOn(jid) {
    try {
        const data = loadUserGroupData();
        return data.welcome && data.welcome[jid] && data.welcome[jid].enabled;
    } catch (error) {
        console.error('Error in isWelcomeOn:', error);
        return false;
    }
}

async function addGoodbye(jid, enabled, message) {
    try {
        const data = loadUserGroupData();
        if (!data.goodbye) data.goodbye = {};

        data.goodbye[jid] = {
            enabled: enabled,
            message: message || `┌─❖
│「 𝗚𝗼𝗼𝗱𝗯𝘆𝗲 👋 」
└┬❖ 「 {user}  」
   │✑  𝗟𝗲𝗳𝘁 
   │✑ {group}
   │✑ You will never be missed 🫦
   └───────────────┈ ⳹`,
            channelId: '@newsletter'
        };

        saveUserGroupData(data);
        return true;
    } catch (error) {
        console.error('Error in addGoodbye:', error);
        return false;
    }
}

async function delGoodBye(jid) {
    try {
        const data = loadUserGroupData();
        if (data.goodbye && data.goodbye[jid]) {
            delete data.goodbye[jid];
            saveUserGroupData(data);
        }
        return true;
    } catch (error) {
        console.error('Error in delGoodBye:', error);
        return false;
    }
}

async function isGoodByeOn(jid) {
    try {
        const data = loadUserGroupData();
        return data.goodbye && data.goodbye[jid] && data.goodbye[jid].enabled;
    } catch (error) {
        console.error('Error in isGoodByeOn:', error);
        return false;
    }
}

// ==================== ANTIBUG HELPER ====================
// Bug patterns for antibug feature
const bugPatterns = [
    /\u0000/g,
    /\u200E{100,}/g,
    /\u200F{100,}/g,
    /\u202A{50,}/g,
    /\u202B{50,}/g,
    /\u202C{50,}/g,
    /\u202D{50,}/g,
    /\u202E{50,}/g,
    /\u2060{50,}/g,
    /\u2061{50,}/g,
    /\u2062{50,}/g,
    /\u2063{50,}/g,
    /\u2064{50,}/g,
    /\uFEFF{50,}/g,
    /[\u0300-\u036F]{50,}/g,
    /(.)\1{500,}/g,
    /\n{100,}/g,
    /\t{100,}/g,
];

function isBugMessage(message) {
    if (!message) return false;

    const text = message.message?.conversation ||
                 message.message?.extendedTextMessage?.text ||
                 message.message?.imageMessage?.caption ||
                 message.message?.videoMessage?.caption || '';

    if (text.length > 50000) return true;

    for (const pattern of bugPatterns) {
        if (pattern.test(text)) return true;
    }

    const vcardData = message.message?.contactMessage?.vcard ||
                      message.message?.contactsArrayMessage?.contacts?.[0]?.vcard || '';
    if (vcardData.length > 10000) return true;

    const buttonCount = message.message?.buttonsMessage?.buttons?.length ||
                       message.message?.templateMessage?.hydratedTemplate?.hydratedButtons?.length || 0;
    if (buttonCount > 10) return true;

    const listCount = message.message?.listMessage?.sections?.reduce((acc, s) => acc + (s.rows?.length || 0), 0) || 0;
    if (listCount > 50) return true;

    return false;
}

module.exports = {
    // Core functions
    loadUserGroupData,
    saveUserGroupData,
    
    // Antifeature functions
    setAntilink,
    getAntilink,
    removeAntilink,
    
    setAntitag,
    getAntitag,
    removeAntitag,
    
    setAntigroupmention,
    getAntigroupmention,
    removeAntigroupmention,
    
    setAntidemote,
    getAntidemote,
    removeAntidemote,
    
    setAntisticker,
    getAntisticker,
    removeAntisticker,
    
    setAntiimage,
    getAntiimage,
    removeAntiimage,
    
    setAntiaudio,
    getAntiaudio,
    removeAntiaudio,
    
    setAntidocument,
    getAntidocument,
    removeAntidocument,
    
    setAntifiles,
    getAntifiles,
    removeAntifiles,
    
    setAntipromote,
    getAntipromote,
    removeAntipromote,
    
    setAntivideo,
    getAntivideo,
    removeAntivideo,
    
    setAntibug,
    getAntibug,
    removeAntibug,
    
    setAntiBadword,
    getAntiBadword,
    removeAntiBadword,
    
    // Antibug helper
    isBugMessage,
    bugPatterns,
    
    // Warning system
    incrementWarningCount,
    resetWarningCount,
    
    // Sudo management
    isSudo,
    addSudo,
    removeSudo,
    getSudoList,
    
    // Welcome/Goodbye
    addWelcome,
    delWelcome,
    isWelcomeOn,
    addGoodbye,
    delGoodBye,
    isGoodByeOn,
    
    // Chatbot
    setChatbot,
    getChatbot,
    removeChatbot
};