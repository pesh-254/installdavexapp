import { loadSettings, updateSetting } from '../../lib/persistentData.js';

export default {
  name: 'antispam',
  description: 'Toggle command anti-spam cooldown',
  category: 'Anti-Commands',
  async execute(msg, { sock, args, isOwner }) {
    if (!isOwner) return;

    const status = args[0]?.toLowerCase();
    if (status === 'on') {
      updateSetting('antiSpam', true);
      await sock.sendMessage(msg.key.remoteJid, { text: '🛡️ Anti-Spam is now ON. 5s cooldown applied to users.' });
    } else if (status === 'off') {
      updateSetting('antiSpam', false);
      await sock.sendMessage(msg.key.remoteJid, { text: '🛡️ Anti-Spam is now OFF.' });
    } else {
      const settings = loadSettings();
      await sock.sendMessage(msg.key.remoteJid, { text: `🛡️ Anti-Spam is currently ${settings.antiSpam ? 'ON' : 'OFF'}. Use "on" or "off" to toggle.` });
    }
  }
};
