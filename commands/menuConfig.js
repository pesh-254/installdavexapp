const { 
    setMenuStyle, 
    getMenuSettings, 
    toggleSetting, 
    MENU_STYLES,
    resetMenuSettings,
    updateMenuSettings
} = require('./menuSettings');

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

async function menuConfigCommand(sock, chatId, message, args) {
    const fakeContact = createFakeContact(message);
    const pushname = message.pushName || "Unknown User";

    if (args.length === 0) {
        // Show current settings
        const settings = getMenuSettings();
        let configMessage = `DAVE X MENU CONFIG\n`;
        configMessage += `Current Style: ${settings.menuStyle} (${MENU_STYLES[settings.menuStyle]})\n`;
        configMessage += `Show Memory: ${settings.showMemory ? 'Enabled' : 'Disabled'}\n`;
        configMessage += `Show Uptime: ${settings.showUptime ? 'Enabled' : 'Disabled'}\n`;
        configMessage += `Show Progress Bar: ${settings.showProgressBar ? 'Enabled' : 'Disabled'}\n`;
        configMessage += `\n`;

        configMessage += `Available Styles:\n`;
        for (const [style, description] of Object.entries(MENU_STYLES)) {
            configMessage += `${style}: ${description}\n`;
        }

        configMessage += `\nUsage:\n`;
        configMessage += `.setmenu style <1-6> - Change menu style\n`;
        configMessage += `.setmenu toggle <setting> - Toggle settings\n`;
        configMessage += `.menuconfig reset - Reset to default\n`;
        configMessage += `.menuconfig preview - Preview current style\n`;

        await sock.sendMessage(chatId, { text: configMessage }, { quoted: fakeContact });
        return;
    }

    const action = args[0].toLowerCase();

    try {
        switch (action) {
            case 'style':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please specify a style number (1-6)' 
                    }, { quoted: fakeContact });
                    return;
                }

                const newStyle = args[1];
                if (setMenuStyle(newStyle)) {
                    await sock.sendMessage(chatId, { 
                        text: `Menu style changed to ${newStyle} (${MENU_STYLES[newStyle]})` 
                    }, { quoted: fakeContact });
                } else {
                    await sock.sendMessage(chatId, { 
                        text: 'Invalid style number. Use 1-6.' 
                    }, { quoted: fakeContact });
                }
                break;

            case 'toggle':
                if (args.length < 2) {
                    await sock.sendMessage(chatId, { 
                        text: 'Please specify a setting to toggle (memory/uptime/progress)' 
                    }, { quoted: fakeContact });
                    return;
                }

                const settingMap = {
                    'memory': 'showMemory',
                    'uptime': 'showUptime', 
                    'progress': 'showProgressBar'
                };

                const settingKey = settingMap[args[1].toLowerCase()];
                if (!settingKey) {
                    await sock.sendMessage(chatId, { 
                        text: 'Invalid setting. Use: memory, uptime, or progress' 
                    }, { quoted: fakeContact });
                    return;
                }

                const newValue = toggleSetting(settingKey);
                await sock.sendMessage(chatId, { 
                    text: `${args[1]} setting ${newValue ? 'enabled' : 'disabled'}` 
                }, { quoted: fakeContact });
                break;

            case 'reset':
                resetMenuSettings();
                await sock.sendMessage(chatId, { 
                    text: 'Menu settings reset to default' 
                }, { quoted: fakeContact });
                break;

            case 'preview':
                // Trigger help command to preview current style
                const helpCommand = require('./help');
                await helpCommand(sock, chatId, message);
                break;

            case 'set':
                if (args.length < 3) {
                    await sock.sendMessage(chatId, { 
                        text: 'Usage: .menuconfig set <setting> <value>\nSettings: memory, uptime, progress\nValues: on/off' 
                    }, { quoted: fakeContact });
                    return;
                }

                const setSettingMap = {
                    'memory': 'showMemory',
                    'uptime': 'showUptime', 
                    'progress': 'showProgressBar'
                };

                const setSettingKey = setSettingMap[args[1].toLowerCase()];
                if (!setSettingKey) {
                    await sock.sendMessage(chatId, { 
                        text: 'Invalid setting. Use: memory, uptime, or progress' 
                    }, { quoted: fakeContact });
                    return;
                }

                const value = args[2].toLowerCase();
                if (value !== 'on' && value !== 'off') {
                    await sock.sendMessage(chatId, { 
                        text: 'Invalid value. Use: on or off' 
                    }, { quoted: fakeContact });
                    return;
                }

                const settingsUpdate = { [setSettingKey]: value === 'on' };
                updateMenuSettings(settingsUpdate);
                await sock.sendMessage(chatId, { 
                    text: `${args[1]} setting ${value === 'on' ? 'enabled' : 'disabled'}` 
                }, { quoted: fakeContact });
                break;

            default:
                await sock.sendMessage(chatId, { 
                    text: 'Unknown action. Use: style, toggle, reset, set, or preview' 
                }, { quoted: fakeContact });
        }
    } catch (error) {
        console.error('Error in menu config:', error);
        await sock.sendMessage(chatId, { 
            text: 'Error configuring menu settings' 
        }, { quoted: fakeContact });
    }
}

module.exports = menuConfigCommand;