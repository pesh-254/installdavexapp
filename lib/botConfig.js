const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'data', 'botconfig.json');

const defaultConfig = {
    botName: 'KOLOLI',
    menuImage: '',
    ownerName: 'Owner',
    welcomeMessage: 'Welcome to the group!',
    goodbyeMessage: 'Goodbye!',
    antideletePrivate: true
};

function initConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        }
        return { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath)) };
    } catch (error) {
        return defaultConfig;
    }
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getBotName() {
    return initConfig().botName;
}

function setBotName(name) {
    const config = initConfig();
    config.botName = name;
    saveConfig(config);
}

function getMenuImage() {
    return initConfig().menuImage;
}

function setMenuImage(url) {
    const config = initConfig();
    config.menuImage = url;
    saveConfig(config);
}

function getOwnerName() {
    return initConfig().ownerName;
}

function setOwnerName(name) {
    const config = initConfig();
    config.ownerName = name;
    saveConfig(config);
}

function isAntideletePrivateEnabled() {
    return initConfig().antideletePrivate !== false;
}

function setAntideletePrivate(enabled) {
    const config = initConfig();
    config.antideletePrivate = enabled;
    saveConfig(config);
}

function getConfig() {
    return initConfig();
}

function updateConfig(updates) {
    const config = initConfig();
    Object.assign(config, updates);
    saveConfig(config);
}

module.exports = {
    getBotName,
    setBotName,
    getMenuImage,
    setMenuImage,
    getOwnerName,
    setOwnerName,
    isAntideletePrivateEnabled,
    setAntideletePrivate,
    getConfig,
    updateConfig
};