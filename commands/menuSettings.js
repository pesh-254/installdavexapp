// commands/menuSettings.js
const fs = require('fs');
const path = require('path');

// Path to store menu settings
const MENU_SETTINGS_FILE = path.join(__dirname, '..', 'data', 'menuSettings.json');

// Default menu style
const DEFAULT_MENU_STYLE = '2';

// Menu style descriptions
const MENU_STYLES = {
    '1': 'Document with thumbnail',
    '2': 'Simple text reply',
    '3': 'Text with external ad reply',
    '4': 'Image with caption',
    '5': 'Interactive message',
    '6': 'Payment request format'
};

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize menu settings file if it doesn't exist
if (!fs.existsSync(MENU_SETTINGS_FILE)) {
    fs.writeFileSync(MENU_SETTINGS_FILE, JSON.stringify({ 
        menuStyle: DEFAULT_MENU_STYLE,
        showMemory: true,
        showUptime: true,
        showPluginCount: true,
        showProgressBar: true
    }, null, 2));
}

// Create fake contact function (same as mute command)
function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "Davex Admin",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Admin;;;\nFN:Davex Admin Tools\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Admin Bot\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

/**
 * Get the current menu style
 * @returns {string} The current menu style
 */
function getMenuStyle() {
    try {
        const data = JSON.parse(fs.readFileSync(MENU_SETTINGS_FILE, 'utf8'));
        return data.menuStyle || DEFAULT_MENU_STYLE;
    } catch (error) {
        console.error('Error reading menu settings file:', error);
        return DEFAULT_MENU_STYLE;
    }
}

/**
 * Set new menu style
 * @param {string} newStyle - The new menu style to set (1-6)
 * @returns {boolean} Success status
 */
function setMenuStyle(newStyle) {
    try {
        // Validate menu style
        if (!['1', '2', '3', '4', '5', '6'].includes(newStyle)) {
            return false;
        }
        
        const currentData = JSON.parse(fs.readFileSync(MENU_SETTINGS_FILE, 'utf8'));
        currentData.menuStyle = newStyle;
        fs.writeFileSync(MENU_SETTINGS_FILE, JSON.stringify(currentData, null, 2));
        return true;
    } catch (error) {
        console.error('Error setting menu style:', error);
        return false;
    }
}

/**
 * Get all menu settings
 * @returns {Object} All menu settings
 */
function getMenuSettings() {
    try {
        return JSON.parse(fs.readFileSync(MENU_SETTINGS_FILE, 'utf8'));
    } catch (error) {
        console.error('Error reading menu settings:', error);
        return { 
            menuStyle: DEFAULT_MENU_STYLE,
            showMemory: true,
            showUptime: true,
            showPluginCount: true,
            showProgressBar: true
        };
    }
}

/**
 * Update menu settings
 * @param {Object} settings - Settings to update
 * @returns {boolean} Success status
 */
function updateMenuSettings(settings) {
    try {
        const currentData = getMenuSettings();
        const newData = { ...currentData, ...settings };
        fs.writeFileSync(MENU_SETTINGS_FILE, JSON.stringify(newData, null, 2));
        return true;
    } catch (error) {
        console.error('Error updating menu settings:', error);
        return false;
    }
}

/**
 * Reset menu settings to default
 * @returns {boolean} Success status
 */
function resetMenuSettings() {
    try {
        const defaultSettings = { 
            menuStyle: DEFAULT_MENU_STYLE,
            showMemory: true,
            showUptime: true,
            showPluginCount: true,
            showProgressBar: true
        };
        fs.writeFileSync(MENU_SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
        return true;
    } catch (error) {
        console.error('Error resetting menu settings:', error);
        return false;
    }
}

/**
 * Toggle specific setting
 * @param {string} setting - Setting name to toggle
 * @returns {boolean} New value of the setting
 */
function toggleSetting(setting) {
    try {
        const currentData = getMenuSettings();
        if (currentData.hasOwnProperty(setting)) {
            currentData[setting] = !currentData[setting];
            fs.writeFileSync(MENU_SETTINGS_FILE, JSON.stringify(currentData, null, 2));
            return currentData[setting];
        }
        return false;
    } catch (error) {
        console.error('Error toggling setting:', error);
        return false;
    }
}

/**
 * Handle menu style command (with fkontak pattern)
 */
async function handleMenuStyleCommand(sock, chatId, message, args) {
    const fakeContact = createFakeContact(message);
    
    if (!args[0]) {
        // Show current settings
        const settings = getMenuSettings();
        const currentStyle = MENU_STYLES[settings.menuStyle] || 'Unknown';
        
        let replyText = `Menu Settings Configuration\n\n`;
        replyText += `Current Style: ${settings.menuStyle} (${currentStyle})\n`;
        replyText += `Show Memory: ${settings.showMemory ? 'Enabled' : 'Disabled'}\n`;
        replyText += `Show Uptime: ${settings.showUptime ? 'Enabled' : 'Disabled'}\n`;
        replyText += `Show Plugin Count: ${settings.showPluginCount ? 'Enabled' : 'Disabled'}\n`;
        replyText += `Show Progress Bar: ${settings.showProgressBar ? 'Enabled' : 'Disabled'}\n\n`;
        replyText += `Available Styles:\n`;
        for (const [key, description] of Object.entries(MENU_STYLES)) {
            replyText += `${key}. ${description}\n`;
        }
        replyText += `\nUsage:\n`;
        replyText += `- To change style: !menu style <1-6>\n`;
        replyText += `- To toggle setting: !menu toggle <setting>\n`;
        replyText += `- To reset all: !menu reset\n`;
        replyText += `\nExample: !menu style 3`;
        
        await sock.sendMessage(chatId, { text: replyText }, { quoted: fakeContact });
        return;
    }
    
    const subCommand = args[0].toLowerCase();
    
    switch(subCommand) {
        case 'style':
            if (!args[1]) {
                await sock.sendMessage(chatId, { 
                    text: 'Please provide a style number (1-6).\nExample: !menu style 3' 
                }, { quoted: fakeContact });
                return;
            }
            
            const styleNum = args[1];
            if (!['1','2','3','4','5','6'].includes(styleNum)) {
                await sock.sendMessage(chatId, { 
                    text: 'Invalid style number. Please choose between 1-6.' 
                }, { quoted: fakeContact });
                return;
            }
            
            const success = setMenuStyle(styleNum);
            if (success) {
                await sock.sendMessage(chatId, { 
                    text: `Menu style changed to option ${styleNum}: ${MENU_STYLES[styleNum]}` 
                }, { quoted: fakeContact });
            } else {
                await sock.sendMessage(chatId, { 
                    text: 'Failed to change menu style. Please try again.' 
                }, { quoted: fakeContact });
            }
            break;
            
        case 'toggle':
            if (!args[1]) {
                await sock.sendMessage(chatId, { 
                    text: 'Please specify which setting to toggle:\nshowMemory, showUptime, showPluginCount, showProgressBar' 
                }, { quoted: fakeContact });
                return;
            }
            
            const setting = args[1];
            const validSettings = ['showMemory', 'showUptime', 'showPluginCount', 'showProgressBar'];
            
            if (!validSettings.includes(setting)) {
                await sock.sendMessage(chatId, { 
                    text: `Invalid setting. Choose from: ${validSettings.join(', ')}` 
                }, { quoted: fakeContact });
                return;
            }
            
            const newValue = toggleSetting(setting);
            if (newValue !== false) {
                await sock.sendMessage(chatId, { 
                    text: `${setting} has been ${newValue ? 'enabled' : 'disabled'}` 
                }, { quoted: fakeContact });
            } else {
                await sock.sendMessage(chatId, { 
                    text: 'Failed to toggle setting. Please try again.' 
                }, { quoted: fakeContact });
            }
            break;
            
        case 'reset':
            const resetSuccess = resetMenuSettings();
            if (resetSuccess) {
                await sock.sendMessage(chatId, { 
                    text: 'All menu settings have been reset to default values.' 
                }, { quoted: fakeContact });
            } else {
                await sock.sendMessage(chatId, { 
                    text: 'Failed to reset menu settings. Please try again.' 
                }, { quoted: fakeContact });
            }
            break;
            
        default:
            await sock.sendMessage(chatId, { 
                text: 'Unknown subcommand. Available: style, toggle, reset' 
            }, { quoted: fakeContact });
    }
}

// Only export what's needed externally
module.exports = {
    getMenuStyle,
    setMenuStyle,
    getMenuSettings,
    updateMenuSettings,
    resetMenuSettings,
    toggleSetting,
    MENU_STYLES,
    DEFAULT_MENU_STYLE,
    handleMenuStyleCommand
};