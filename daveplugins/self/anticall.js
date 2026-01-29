import fs from 'fs';
import path from 'path';
import config from '../../config.js';

const ANTICALL_PATH = path.join(process.cwd(), 'data', 'anticall.json');

function readState() {
    try {
        let localState = { voice: 'off', video: 'off', mode: 'cut' };
        if (fs.existsSync(ANTICALL_PATH)) {
            const raw = fs.readFileSync(ANTICALL_PATH, 'utf8');
            const data = JSON.parse(raw || '{}');
            localState = {
                voice: data.voice || 'off',
                video: data.video || 'off',
                mode: data.mode || 'cut'
            };
        }

        // Environment variable priority
        return {
            voice: config.antiCall ? 'on' : localState.voice,
            video: config.antiVideoCall ? 'on' : localState.video,
            mode: config.antiCallMode || localState.mode
        };
    } catch {
        return { voice: 'off', video: 'off', mode: 'cut' };
    }
}

function writeState(state) {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(ANTICALL_PATH, JSON.stringify(state, null, 2));
    } catch (err) {}
}

export default {
    name: 'anticall',
    description: 'Auto-reject and block incoming calls (self mode only)',
    aliases: ['antivideocall'],
    async execute(msg, { sock, args, settings }) {
        const from = msg.key.remoteJid;
        
        if (!msg.key.fromMe) {
            return await sock.sendMessage(from, {
                text: '❌ This is a self mode command. Only accessible when using your own account.'
            }, { quoted: msg });
        }

        const state = readState();
        const bodyText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const isVideoCmd = bodyText.startsWith(settings.prefix + 'antivideocall');
        const cmd = isVideoCmd ? 'video' : 'voice';
        
        const sub = (args[0] || '').trim().toLowerCase();
        const modeArg = (args[1] || '').trim().toLowerCase();

        if (!sub || (sub !== 'on' && sub !== 'off' && sub !== 'status' && sub !== 'cut' && sub !== 'block')) {
            await sock.sendMessage(from, { 
                text: `📵 *${cmd.toUpperCase()} CALL CONFIGURATION*

📊 **Voice Anticall:** ${state.voice === 'on' ? '✅ Enabled' : '❌ Disabled'}
📊 **Video Anticall:** ${state.video === 'on' ? '✅ Enabled' : '❌ Disabled'}
⚙️ **Mode:** ${state.mode.toUpperCase()}

_Note: Values are synced with Environment Variables if set._`
            }, { quoted: msg });
            return;
        }

        if (sub === 'status') {
            await sock.sendMessage(from, { 
                text: `📊 *ANTICALL STATUS*\n\n🔊 Voice: ${state.voice.toUpperCase()}\n📹 Video: ${state.video.toUpperCase()}\n🛠️ Mode: ${state.mode.toUpperCase()}` 
            }, { quoted: msg });
            return;
        }

        if (sub === 'cut' || sub === 'block') {
            state.mode = sub;
            writeState(state);
            await sock.sendMessage(from, { text: `✅ Call rejection mode set to: *${sub.toUpperCase()}*` });
            return;
        }

        if (cmd === 'voice') state.voice = sub;
        else state.video = sub;
        
        if (modeArg === 'cut' || modeArg === 'block') state.mode = modeArg;

        writeState(state);
        await sock.sendMessage(from, { 
            text: `✅ ${cmd.toUpperCase()} Anticall is now *${sub.toUpperCase()}*.\nMode: *${state.mode.toUpperCase()}*` 
        }, { quoted: msg });
    }
};

export { readState };
