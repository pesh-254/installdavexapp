

export const menuButtonsConfig = {
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363400480173280@newsletter',
    newsletterName: 'Dave Tech',
    serverMessageId: -1
  },
  externalAdReply: {
    title: 'VENOM-X',
    body: 'Davex-254 Bot',
    thumbnailUrl: 'https://files.catbox.moe/x3qrcc.jpg',
    sourceUrl: 'https://github.com/Davex-254/VENOM-X',
    mediaType: 1,
    renderLargerThumbnail: true,
    showAdAttribution: false
  }
};

export const repoButtons = {
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363400480173280@newsletter',
    newsletterName: 'Dave Tech',
    serverMessageId: -1
  },
  externalAdReply: {
    title: 'VENOM-X REPO',
    body: 'Davex-254 Source',
    thumbnailUrl: 'https://files.catbox.moe/x3qrcc.jpg',
    sourceUrl: 'https://github.com/Davex-254/VENOM-X',
    mediaType: 1,
    renderLargerThumbnail: false,
    showAdAttribution: false
  }
};

export const menuButtons = {
  mainButtons: [
    {
      buttonId: "menu_basic",
      buttonText: { displayText: "Basic Tools" },
      type: 1
    },
    {
      buttonId: "menu_group",
      buttonText: { displayText: "Group" },
      type: 1
    },
    {
      buttonId: "menu_ai",
      buttonText: { displayText: "AI" },
      type: 1
    }
  ],

  repoButtons: [
    {
      buttonId: "repo_main",
      buttonText: { displayText: "GitHub" },
      type: 1
    },
    {
      buttonId: "creator_contact",
      buttonText: { displayText: "Creator" },
      type: 1
    },
    {
      buttonId: "contact_support",
      buttonText: { displayText: "Support" },
      type: 1
    }
  ],

  quickActions: [
    {
      buttonId: "status_bot",
      buttonText: { displayText: "Status" },
      type: 1
    },
    {
      buttonId: "help_support",
      buttonText: { displayText: "Help" },
      type: 1
    }
  ]
};

export const buttonResponses = {
  repo_main: {
    text: "VENOM-X Repo\nGitHub: https://github.com/Davex-254/VENOM-X",
    url: "https://github.com/Davex-254/VENOM-X"
  },

  repo_web: {
    text: "VENOM-X Pair Site\nSite: https://davexx-sessionpair.onrender.com/pair",
    url: "https://davexx-sessionpair.onrender.com"
  },

  creator_contact: {
    text: "Creator: Davex-254\nWhatsApp: +254104260236\nTelegram: @Digladoo\nSite: https://www.davexmainweb.zone.id/",
    contact: {
      phone: "+254104260236",
      name: "Davex-254"
    }
  },

  status_bot: {
    text: "VENOM-X Status\nOnline\nDavex-254"
  },

  help_support: {
    text: "VENOM-X Support\nTelegram: @Digladoo\nSite: https://www.davexmainweb.zone.id/"
  },

  contact_support: {
    text: "VENOM-X Channels\nSite: https://www.davexmainweb.zone.id/\nTelegram: @Digladoo\nChannel: https://whatsapp.com/channel/0029VaIiMsqJf05e4Y4b9u0z",
    url: "https://www.davexmainweb.zone.id/"
  }
};