import fs from 'fs';
import path from 'path';
import config from '../../config.js';

// Owner number for access control (config.ownerNumber should be something like "+2349xxxxxxxxx" or "2349xxxxxxxxx" or "09xxxxxxxx")
const OWNER_NUMBER = String(config.ownerNumber || '').trim();
const OWNER_JID = `${OWNER_NUMBER.replace(/^\+/, '')}@s.whatsapp.net`;

const DATA_DIR = path.resolve('./data');
const ANTIBUG_FILE = path.join(DATA_DIR, 'antibug_settings.json');

// Helper: strip non-digits
function stripDigits(s = '') {
  return String(s).replace(/\D/g, '');
}

// Helper: fuzzy compare two phone numbers (handles +, 0, country code differences)
// Returns true if they look like the same number (one endsWith the other or equal)
function isSameNumber(a = '', b = '') {
  const A = stripDigits(a);
  const B = stripDigits(b);
  if (!A || !B) return false;
  return A === B || A.endsWith(B) || B.endsWith(A);
}

// Load antibug settings
function loadAntibugSettings() {
  if (!fs.existsSync(ANTIBUG_FILE)) {
    return { enabled: false };
  }
  try {
    return JSON.parse(fs.readFileSync(ANTIBUG_FILE, 'utf-8'));
  } catch (err) {
    console.error('[ANTIBUG] failed reading settings:', err.message);
    return { enabled: false };
  }
}

// Save antibug settings
function saveAntibugSettings(settings) {
  try {
    fs.writeFileSync(ANTIBUG_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('[ANTIBUG] failed saving settings:', err.message);
  }
}

export default {
  name: 'antibug',
  description: '🛡️ Enable or disable anti-spam/antibug feature (Owner only)',
  aliases: ['antispam', 'pmlock'],
  category: 'Owner',
  async execute(msg, { sock, args }) {
    const from = msg.key.remoteJid;
    // participant exists in group messages; for DMs it may be undefined
    const senderJid = msg.key.participant || msg.key.remoteJid;
    // sender's raw id (without @... part) for number matching
    const senderNumber = (senderJid || '').split('@')[0];

    // bot identity (best-effort): sock.user may have id or return user object
    let botJid = null;
    try {
      if (sock?.user) {
        // sometimes sock.user is { id: '12345@s.whatsapp.net', ... } or string '12345@s.whatsapp.net'
        botJid = typeof sock.user === 'string' ? sock.user : (sock.user.id || sock.user?.jid || null);
      }
    } catch (e) {
      botJid = null;
    }

    console.log(`[DEBUG][antibug] triggered by senderJid=${senderJid} from=${from} botJid=${botJid}`);

    const userName = msg.pushName || "User";

    // Determine if caller is owner:
    // 1) exact JID match with configured OWNER_JID
    // 2) fuzzy number matching with OWNER_NUMBER
    // 3) message is sent BY THE BOT itself (msg.key.fromMe === true)
    // 4) senderJid equals botJid (some systems may surface bot JID here)
    const normalizedSender = senderNumber || '';
    const isOwnerNumber = isSameNumber(normalizedSender, OWNER_NUMBER);
    const isExactOwnerJid = senderJid === OWNER_JID;
    const isFromBot = Boolean(msg.key?.fromMe) === true;
    const isSenderBotJid = !!(botJid && senderJid === botJid);

    const isOwner = isExactOwnerJid || isOwnerNumber || isFromBot || isSenderBotJid;

    console.log(`[DEBUG][antibug] checks => isExactOwnerJid=${isExactOwnerJid}, isOwnerNumber=${isOwnerNumber}, isFromBot=${isFromBot}, isSenderBotJid=${isSenderBotJid} => isOwner=${isOwner}`);

    if (!isOwner) {
      console.log(`[DEBUG][antibug] Access denied for ${senderJid}`);
      await sock.sendMessage(from, {
        text: `❌ *Access Denied*\n\nThis command is only available to the bot owner.`
      }, { quoted: msg });
      return;
    }

    const settings = loadAntibugSettings();

    // If no argument provided, show current status
    if (!args[0]) {
      const status = settings.enabled ? '✅ Enabled' : '❌ Disabled';
      await sock.sendMessage(from, {
        text: `🛡️ *Antibug/Anti-Spam Status*\n\n*Current Status:* ${status}\n\n💡 *Usage:*\n• ${config.prefix}antibug on - Enable\n• ${config.prefix}antibug off - Disable\n\n*Protection Details:*\n• Triggers when: >2 messages in 1 second\n• Action taken: Automatic block\n• Notification sent to group\n\n*Note:* Make sure the bot has admin permissions to block users in groups.`
      }, { quoted: msg });
      return;
    }

    const action = args[0].toLowerCase().trim();

    if (action === 'on' || action === 'enable') {
      if (settings.enabled) {
        await sock.sendMessage(from, {
          text: `⚠️ *Antibug feature is already enabled!*`
        }, { quoted: msg });
        return;
      }

      settings.enabled = true;
      saveAntibugSettings(settings);

      await sock.sendMessage(from, {
        text: `✅ *Antibug Feature Enabled*\n\n🛡️ Anti-spam protection is now active!\n\n*Protection:* Users sending more than 2 messages per second will be automatically blocked.`
      }, { quoted: msg });

    } else if (action === 'off' || action === 'disable') {
      if (!settings.enabled) {
        await sock.sendMessage(from, {
          text: `⚠️ *Antibug feature is already disabled!*`
        }, { quoted: msg });
        return;
      }

      settings.enabled = false;
      saveAntibugSettings(settings);

      await sock.sendMessage(from, {
        text: `❌ *Antibug Feature Disabled*\n\n🛡️ Anti-spam protection has been turned off.`
      }, { quoted: msg });

    } else {
      await sock.sendMessage(from, {
        text: `⚠️ *Invalid Option*\n\n💡 *Usage:*\n• ${config.prefix}antibug on - Enable\n• ${config.prefix}antibug off - Disable`
      }, { quoted: msg });
    }
  }
};
