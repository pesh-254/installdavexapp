const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'data', 'antichart.json');

function initConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            const defaultConfig = {};
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            return defaultConfig;
        }
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        return {};
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {}
}

async function antichartCommand(sock, chatId, message, args) {
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) return;

    const config = initConfig();
    const action = args[0]?.toLowerCase();
    const target = message.message?.extendedTextMessage?.contextInfo?.participant || args[1]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

    if (action === 'on' && target) {
        if (!config[chatId]) config[chatId] = [];
        if (!config[chatId].includes(target)) config[chatId].push(target);
        saveConfig(config);
        await sock.sendMessage(chatId, { text: `✅ User @${target.split('@')[0]} is now blocked from sending messages in this group.`, mentions: [target] });
    } else if (action === 'off' && target) {
        if (config[chatId]) {
            config[chatId] = config[chatId].filter(id => id !== target);
            saveConfig(config);
        }
        await sock.sendMessage(chatId, { text: `✅ User @${target.split('@')[0]} is now allowed to send messages in this group.`, mentions: [target] });
    } else {
        await sock.sendMessage(chatId, { text: 'Usage: .antichart on/off @user' });
    }
}

async function handleChartDetection(sock, chatId, message, senderId) {
    const config = initConfig();
    if (config[chatId] && config[chatId].includes(senderId)) {
        await sock.sendMessage(chatId, { delete: message.key });
    }
}

module.exports = { antichartCommand, handleChartDetection };
