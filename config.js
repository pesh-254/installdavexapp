
import settings from './settings.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file if it exists
dotenv.config({ path: path.join(__dirname, '.env') });

// Load app.json configuration
let appJsonConfig = {};
try {
  const appJsonPath = path.join(__dirname, 'app.json');
  if (fs.existsSync(appJsonPath)) {
    const appJsonData = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));

    // Extract default values from app.json env configuration
    if (appJsonData.env) {
      Object.keys(appJsonData.env).forEach(key => {
        const envConfig = appJsonData.env[key];
        if (envConfig.value !== undefined) {
          appJsonConfig[key] = envConfig.value;
        }
      });
    }
  }
} catch (error) {}

// Helper function to get env variable with fallback priority:
const getEnvValue = (key, defaultValue) => {
  return process.env[key] || appJsonConfig[key] || defaultValue;
};

const parseBool = (val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
        const normalized = val.toLowerCase().trim();
        return normalized === 'true' || normalized === 'on' || normalized === 'yes';
    }
    return false;
};

export default {
  // Bot configuration
  prefix: getEnvValue('BOT_PREFIX', '.'),
  ownerNumber: getEnvValue('BOT_NUMBER', ''),
  botName: getEnvValue('BOT_NAME', '𝔼𝕔𝕝𝕚𝕡𝕤𝕖 𝕄𝔻'),
  ownerName: getEnvValue('BOT_OWNER_NAME', 'Davex-254'),
  sessionId: 'VENOM-X-SESSION-ID',
  BOOM_MESSAGE_LIMIT: 50,

  // AI configurations
  openaiApiKey: getEnvValue('OPENAI_API_KEY', settings.openaiApiKey),
  giphyApiKey: getEnvValue('GIPHY_API_KEY', settings.giphyApiKey),
  geminiApiKey: getEnvValue('GEMINI_API_KEY', settings.geminiApiKey),
  imgurClientId: getEnvValue('IMGUR_CLIENT_ID', settings.imgurClientId),
  copilotApiKey: getEnvValue('COPILOT_API_KEY', settings.copilotApiKey),
  FOOTBALL_API_KEY: getEnvValue('FOOTBALL_API_KEY', settings.FOOTBALL_API_KEY),

  // Session data
  sessionData: getEnvValue('BOT_SESSION_DATA', ''),

  // Automation Settings (Env support)
  autoViewMessage: parseBool(getEnvValue('AUTO_VIEW_MESSAGE', false)),
  autoViewStatus: parseBool(getEnvValue('AUTO_VIEW_STATUS', false)),
  autoReactStatus: parseBool(getEnvValue('AUTO_REACT_STATUS', false)),
  autoReact: parseBool(getEnvValue('AUTO_REACT', false)),
  autoStatusEmoji: getEnvValue('AUTO_STATUS_EMOJI', '❤️'),
  autoTyping: parseBool(getEnvValue('AUTO_TYPING', false)),
  autoRecording: parseBool(getEnvValue('AUTO_RECORDING', false)),

  // Anti-Settings (Env support)
  antiCall: parseBool(getEnvValue('ANTICALL', false)),
  antiVideoCall: parseBool(getEnvValue('ANTIVIDEOCALL', false)),
  antiDelete: parseBool(getEnvValue('ANTIDELETE', false)),
  antiLink: parseBool(getEnvValue('ANTILINK', false)),
  antiBug: parseBool(getEnvValue('ANTIBUG', false)),
  antiSpam: parseBool(getEnvValue('ANTISPAM', false)),
  antiTag: parseBool(getEnvValue('ANTITAG', false)),
  antiCallMode: getEnvValue('ANTICALL_MODE', 'cut'), // 'cut' or 'block'
};
