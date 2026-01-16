const isAdmin = require('../lib/isAdmin');

const quotes = [
  "Stay strong", "Never quit", "Dream big", "Keep going", "Work hard",
  "Be brave", "Think positive", "Stay focused", "Move forward", "Believe yourself",
  "Take action", "Stay humble", "Choose happiness", "Embrace change", "Trust process",
  "Create value", "Be kind", "Stay curious", "Find balance", "Make impact",
  "Stay motivated", "Push boundaries", "Seek growth", "Live fully", "Chase dreams",
  "Build legacy", "Stay authentic", "Inspire others", "Own it", "Hustle hard",
  "Stay positive", "Break barriers", "Rise up", "Stay hungry", "Think different",
  "Be fearless", "Stay committed", "Create magic", "Win together", "Stay resilient"
];

const getContact = (msg) => {
  const id = msg.key.participant?.split('@')[0] || msg.key.remoteJid.split('@')[0];
  return {
    key: { participants: "0@s.whatsapp.net", remoteJid: "0@s.whatsapp.net", fromMe: false },
    message: {
      contactMessage: {
        displayName: "Davex Admin",
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Admin;;;\nFN:Davex Admin Tools\nitem1.TEL;waid=${id}:${id}\nitem1.X-ABLabel:Admin Bot\nEND:VCARD`
      }
    },
    participant: "0@s.whatsapp.net"
  };
};

const getQuote = () => quotes[Math.floor(Math.random() * quotes.length)];

async function muteCommand(sock, chatId, senderId, message, duration) {
  const contact = getContact(message);
  const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

  if (!isBotAdmin) {
    return sock.sendMessage(chatId, { text: 'Bot requires admin privileges.' }, { quoted: contact });
  }

  if (!isSenderAdmin) {
    return sock.sendMessage(chatId, { text: 'Admin access required for this command.' }, { quoted: contact });
  }

  try {
    let groupName = "the group";
    try {
      const metadata = await sock.groupMetadata(chatId);
      groupName = metadata.subject || "the group";
    } catch (e) {
      console.error('Metadata error:', e);
    }

    await sock.groupSettingUpdate(chatId, 'announcement');

    if (duration && duration > 0) {
      await sock.sendMessage(chatId, { 
        text: `${groupName} has been muted for ${duration} minutes.\n${getQuote()}` 
      }, { quoted: contact });

      setTimeout(async () => {
        try {
          await sock.groupSettingUpdate(chatId, 'not_announcement');
          await sock.sendMessage(chatId, { 
            text: `${groupName} has been unmuted automatically.\n${getQuote()}`,
            quoted: contact 
          });
        } catch (e) {
          console.error('Auto-unmute error:', e);
          await sock.sendMessage(chatId, { 
            text: `Failed to unmute ${groupName} automatically. Please do it manually.\n${getQuote()}`,
            quoted: contact 
          });
        }
      }, duration * 60 * 1000);
    } else {
      await sock.sendMessage(chatId, { 
        text: `${groupName} has been muted.\n${getQuote()}` 
      }, { quoted: contact });
    }
  } catch (err) {
    console.error('Mute error:', err);
    await sock.sendMessage(chatId, { 
      text: `Error processing mute request.\n${getQuote()}` 
    }, { quoted: contact });
  }
}

module.exports = muteCommand;
