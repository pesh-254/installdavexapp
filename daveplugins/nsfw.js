import axios from 'axios';

// Generic NSFW fetcher with multiple API fallbacks
async function fetchNSFW(category) {
  const apis = [
    { url: `https://api.waifu.pics/nsfw/${category}`, format: 'url' },
    { url: `https://nekos.best/api/v2/${category}`, format: 'results' },
    { url: `https://purrbot.site/api/img/nsfw/${category}/gif`, format: 'link' }
  ];

  for (const api of apis) {
    try {
      const response = await axios.get(api.url, { timeout: 10000 });
      if (response.data) {
        if (api.format === 'url' && response.data.url) return response.data.url;
        if (api.format === 'results' && response.data.results?.[0]?.url) return response.data.results[0].url;
        if (api.format === 'link' && response.data.link) return response.data.link;
      }
    } catch (error) {
      console.log(`[NSFW ${category}] API ${api.url} failed, trying next...`);
      continue;
    }
  }
  throw new Error('All APIs failed');
}

// NSFW command generator
function createNSFWCommand(name, category, description) {
  return {
    name,
    description: `🔞 ${description}`,
    category: 'NSFW',
    async execute(msg, { sock }) {
      const dest = msg.key.remoteJid;
      try {
        await sock.sendMessage(dest, {
          react: { text: '⏳', key: msg.key }
        });

        const url = await fetchNSFW(category);

        await sock.sendMessage(dest, {
          image: { url },
          caption: `🔞 *${description}*\n\n⚠️ NSFW Content`
        }, { quoted: msg });

        await sock.sendMessage(dest, {
          react: { text: '✅', key: msg.key }
        });
      } catch (error) {
        console.error(`[NSFW ${name}] Error:`, error.message);
        await sock.sendMessage(dest, {
          text: `❌ Failed to fetch ${name} content. Try again later.`
        }, { quoted: msg });
      }
    }
  };
}

// Export all NSFW commands - single lowercase names only
export default [
  createNSFWCommand('trap', 'trap', 'Trap content'),
  createNSFWCommand('waifu', 'waifu', 'NSFW Waifu'),
  createNSFWCommand('neko', 'neko', 'NSFW Neko'),
  createNSFWCommand('cum', 'cum', 'Cum content'),
  createNSFWCommand('pussy', 'pussy', 'Pussy content'),
  createNSFWCommand('feet', 'feet', 'Feet content'),
  createNSFWCommand('anal', 'anal', 'Anal content'),
  createNSFWCommand('boobs', 'boobs', 'Boobs content'),
  createNSFWCommand('ass', 'ass', 'Ass content'),
  createNSFWCommand('yuri', 'yuri', 'Yuri content'),
  createNSFWCommand('bdsm', 'bdsm', 'BDSM content'),
  createNSFWCommand('dick', 'dick', 'Dick content'),
  createNSFWCommand('black', 'black', 'Black content'),
  createNSFWCommand('easter', 'easter', 'Easter content'),
  createNSFWCommand('bottomless', 'bottomless', 'Bottomless content'),
  createNSFWCommand('futa', 'futa', 'Futa content'),
  createNSFWCommand('gay', 'gay', 'Gay content'),
  createNSFWCommand('gif', 'gif', 'GIF content'),
  createNSFWCommand('groupfuck', 'group', 'Group content'),
  createNSFWCommand('collared', 'collared', 'Collared content'),
  createNSFWCommand('cumslut', 'cumslut', 'Cumslut content'),
  createNSFWCommand('dp', 'dp', 'DP content'),
  createNSFWCommand('domination', 'domination', 'Domination content'),
  createNSFWCommand('extreme', 'extreme', 'Extreme content'),
  createNSFWCommand('finger', 'finger', 'Finger content'),
  createNSFWCommand('puffies', 'puffies', 'Puffies content'),
  createNSFWCommand('kiss', 'kiss', 'Kiss content'),
  createNSFWCommand('lick', 'lick', 'Lick content'),
  createNSFWCommand('pegged', 'pegged', 'Pegged content'),
  createNSFWCommand('real', 'real', 'Real content'),
  createNSFWCommand('suck', 'suck', 'Suck content'),
  createNSFWCommand('tiny', 'tiny', 'Tiny content'),
  createNSFWCommand('toys', 'toys', 'Toys content'),
  createNSFWCommand('xmas', 'xmas', 'Xmas content'),
  createNSFWCommand('tattoo', 'tattoo', 'Tattoo content'),
  createNSFWCommand('pornhub', 'phgif', 'Pornhub GIF content'),
  createNSFWCommand('oral', 'oral', 'Oral content')
];