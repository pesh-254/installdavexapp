const axios = require('axios');

function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DaveX",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DaveX\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

async function gpt4Command(sock, chatId, message) {
  try {
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || 
                 message.text;

    if (!text) {
      const fake = createFakeContact(message);
      return sock.sendMessage(chatId, { text: "Type your question after !gpt\nExample: !gpt explain quantum physics" }, { quoted: fake });
    }

    const [command, ...rest] = text.split(' ');
    const query = rest.join(' ').trim();

    if (!query) {
      const fake = createFakeContact(message);
      return sock.sendMessage(chatId, { text: "❌ Missing question\nExample: !gpt what is AI?" }, { quoted: fake });
    }

    await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });
    await handleAI(sock, chatId, message, query);

  } catch (err) {
    console.error('AI Command Error:', err);
    const fake = createFakeContact(message);
    await sock.sendMessage(chatId, { text: "❌ AI service error" }, { quoted: fake });
  }
}

async function handleAI(sock, chatId, message, query) {
  try {
    const url = "https://api.openai.com/v1/chat/completions";
    const { data } = await axios.post(
      url,
      {
        model: "gpt-4",
        messages: [{ role: "user", content: query }],
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const reply = data.choices?.[0]?.message?.content || "⚠️ No response";
    const fake = createFakeContact(message);
    await sock.sendMessage(chatId, { text: reply }, { quoted: fake });

  } catch (err) {
    console.error('API Error:', err);
    const fake = createFakeContact(message);
    const msg = err.response?.status === 429 
      ? "❌ Too many requests, try later" 
      : "❌ API connection failed";
    await sock.sendMessage(chatId, { text: msg }, { quoted: fake });
  }
}

module.exports = gpt4Command;