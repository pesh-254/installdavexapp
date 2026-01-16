const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'data', 'autotyping.json');

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

function initConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            const defaultConfig = { 
                enabled: false, 
                duration: 3000,
                pm: false,
                group: false
            };
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        console.error('Error loading autotyping config:', error);
        return { 
            enabled: false, 
            duration: 3000,
            pm: false,
            group: false
        };
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving autotyping config:', error);
    }
}

async function autotypingCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);

        if (!message.key.fromMe) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!'
            }, { quoted: fake });
            return;
        }

        const text = message.message?.conversation?.trim() || 
                    message.message?.extendedTextMessage?.text?.trim() || '';
        const args = text.split(' ').slice(1);
        const config = initConfig();

        if (args.length === 0) {
            // Show help/status
            await sock.sendMessage(chatId, {
                text: `⌨️ *Auto-Typing Commands*\n\n` +
                      `Status: ${config.enabled ? '✅ ON' : '❌ OFF'}\n` +
                      `PM: ${config.pm ? '✅ Enabled' : '❌ Disabled'}\n` +
                      `Group: ${config.group ? '✅ Enabled' : '❌ Disabled'}\n` +
                      `Duration: ${config.duration}ms\n\n` +
                      `📋 *Usage:*\n` +
                      `• .autotyping on/off\n` +
                      `• .autotyping pm on/off\n` +
                      `• .autotyping group on/off\n` +
                      `• .autotyping duration [1000-10000]\n` +
                      `• .autotyping status`
            }, { quoted: fake });
            return;
        }

        const action = args[0].toLowerCase();
        const mode = args[1]?.toLowerCase();
        
        if (action === 'on') {
            config.enabled = true;
            saveConfig(config);
            await sock.sendMessage(chatId, {
                text: '✅ Auto-typing enabled!'
            }, { quoted: fake });
            
        } else if (action === 'off') {
            config.enabled = false;
            saveConfig(config);
            await sock.sendMessage(chatId, {
                text: '❌ Auto-typing disabled!'
            }, { quoted: fake });
            
        } else if (action === 'pm' && (mode === 'on' || mode === 'off')) {
            config.pm = mode === 'on';
            config.enabled = true;
            saveConfig(config);
            
            await sock.sendMessage(chatId, {
                text: `✅ PM typing ${config.pm ? 'ENABLED' : 'DISABLED'}!`
            }, { quoted: fake });
            
        } else if (action === 'group' && (mode === 'on' || mode === 'off')) {
            config.group = mode === 'on';
            config.enabled = true;
            saveConfig(config);
            
            await sock.sendMessage(chatId, {
                text: `✅ Group typing ${config.group ? 'ENABLED' : 'DISABLED'}!`
            }, { quoted: fake });
            
        } else if (action === 'duration' && args[1]) {
            const duration = parseInt(args[1]);
            if (!isNaN(duration) && duration >= 1000 && duration <= 10000) {
                config.duration = duration;
                saveConfig(config);
                await sock.sendMessage(chatId, {
                    text: `⌨️ Typing duration set to ${duration}ms`
                }, { quoted: fake });
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ Duration must be between 1000ms and 10000ms'
                }, { quoted: fake });
            }
            
        } else if (action === 'status') {
            await sock.sendMessage(chatId, {
                text: `⌨️ *Auto-Typing Status*\n\n` +
                      `Global: ${config.enabled ? '✅ ON' : '❌ OFF'}\n` +
                      `PM: ${config.pm ? '✅ Enabled' : '❌ Disabled'}\n` +
                      `Group: ${config.group ? '✅ Enabled' : '❌ Disabled'}\n` +
                      `Duration: ${config.duration}ms`
            }, { quoted: fake });
            
        } else {
            await sock.sendMessage(chatId, {
                text: '❌ Invalid command!\n\nUsage:\n• .autotyping on/off\n• .autotyping pm on/off\n• .autotyping group on/off\n• .autotyping duration [ms]\n• .autotyping status'
            }, { quoted: fake });
        }

    } catch (error) {
        console.error('Error in autotyping command:', error);
    }
}

function isAutotypingEnabled(isGroup = false) {
    try {
        const config = initConfig();
        if (!config.enabled) return false;
        
        if (isGroup) {
            return config.group;
        } else {
            return config.pm;
        }
    } catch (error) {
        return false;
    }
}

async function safeTypingPresence(sock, chatId, isGroup = false) {
    if (!isAutotypingEnabled(isGroup)) return false;

    try {
        const config = initConfig();
        const duration = config.duration || 3000;

        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, Math.min(duration, 10000)));
        await sock.sendPresenceUpdate('paused', chatId);
        return true;
    } catch (error) {
        console.error('Error in safe typing presence:', error);
        return false;
    }
}

async function handleAutotypingForMessage(sock, chatId, userMessage, isGroup = false) {
    return await safeTypingPresence(sock, chatId, isGroup);
}

async function handleAutotypingForCommand(sock, chatId, isGroup = false) {
    return await safeTypingPresence(sock, chatId, isGroup);
}

async function showTypingAfterCommand(sock, chatId, isGroup = false) {
    return await safeTypingPresence(sock, chatId, isGroup);
}

module.exports = {
    autotypingCommand,
    isAutotypingEnabled,
    safeTypingPresence,
    handleAutotypingForMessage,
    handleAutotypingForCommand,
    showTypingAfterCommand
};