import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

// Color function for console logs
const color = (text, colorCode) => {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    reset: '\x1b[0m'
  };
  return colors[colorCode] ? colors[colorCode] + text + colors.reset : text;
};

// Simplified Double-Line ASCII Art
const asciiArt = `
  ══════════════════════════════════════════════════════
    ╔═╗╔═╗╦  ╦╔═╗╔═╗╔═╗   ╔╦╗╔╦╗
    ║╣ ║  ║  ║╠═╝╚═╗║╣ ───║║║║║║
    ╚═╝╚═╝╩═╝╩╩  ╚═╝╚═╝   ╩ ╩╩ ╩
  ══════════════════════════════════════════════════════
`;

app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>𝔼𝕔𝕝𝕚𝕡𝕤𝕖 𝕄𝔻 - Status</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=JetBrains+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #050505;
            --accent-color: #00f2ff;
            --text-color: #e0e0e0;
            --panel-bg: rgba(20, 20, 20, 0.8);
        }

        body {
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(circle at 2px 2px, rgba(0, 242, 255, 0.1) 1px, transparent 0);
            background-size: 40px 40px;
            color: var(--text-color);
            font-family: 'JetBrains+Mono', monospace;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
        }

        .container {
            position: relative;
            width: 90%;
            max-width: 600px;
            background: var(--panel-bg);
            border: 1px solid rgba(0, 242, 255, 0.3);
            border-radius: 4px;
            padding: 40px;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 50px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 242, 255, 0.05);
            text-align: center;
        }

        .container::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 2px;
            background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
        }

        .ascii-art {
            font-family: monospace;
            white-space: pre;
            color: var(--accent-color);
            font-size: 10px;
            line-height: 1.2;
            margin-bottom: 30px;
            text-shadow: 0 0 10px var(--accent-color);
            opacity: 0.8;
        }

        h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 2rem;
            letter-spacing: 4px;
            color: var(--accent-color);
            margin: 10px 0;
            text-transform: uppercase;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            background: rgba(0, 242, 255, 0.1);
            border: 1px solid var(--accent-color);
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.8rem;
            margin: 20px 0;
            color: var(--accent-color);
            font-weight: bold;
        }

        .pulse {
            width: 8px;
            height: 8px;
            background-color: var(--accent-color);
            border-radius: 50%;
            margin-right: 10px;
            box-shadow: 0 0 10px var(--accent-color);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 242, 255, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 242, 255, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 242, 255, 0); }
        }

        .details {
            font-size: 0.9rem;
            color: #888;
            margin-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 20px;
        }

        .btn-music {
            background: transparent;
            border: 1px solid var(--accent-color);
            color: var(--accent-color);
            padding: 10px 20px;
            cursor: pointer;
            font-family: 'JetBrains+Mono', monospace;
            font-size: 0.8rem;
            margin-top: 30px;
            transition: all 0.3s;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .btn-music:hover {
            background: var(--accent-color);
            color: #000;
            box-shadow: 0 0 20px var(--accent-color);
        }

        #volumeControl {
            margin-top: 15px;
            display: none;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        input[type=range] {
            accent-color: var(--accent-color);
            width: 100px;
        }

        .scanline {
            width: 100%;
            height: 100px;
            z-index: 8;
            background: linear-gradient(0deg, rgba(0, 0, 0, 0) 0%, rgba(0, 242, 255, 0.03) 50%, rgba(0, 0, 0, 0) 100%);
            opacity: 0.1;
            position: absolute;
            bottom: 100%;
            pointer-events: none;
            animation: scanline 6s linear infinite;
        }

        @keyframes scanline {
            0% { bottom: 100%; }
            100% { bottom: -100px; }
        }
    </style>
</head>
<body>
    <div class="scanline"></div>
    <div class="container">
        <div class="ascii-art">${asciiArt}</div>
        <h1>Eclipse MD</h1>
        <div class="status-badge">
            <div class="pulse"></div>
            SYSTEM OPERATIONAL
        </div>
        <p style="letter-spacing: 1px; opacity: 0.6;">NODE JS V20 • BAILEYS V6 • AI ENABLED</p>
        
        <button id="musicBtn" class="btn-music">Initialize Background Audio</button>
        <div id="volumeControl">
            <span style="font-size: 12px;">VOL</span>
            <input type="range" id="volume" min="0" max="1" step="0.1" value="0.5">
        </div>

        <div class="details">
            LAST SYNC: ${new Date().toLocaleTimeString()} • SESSION: ACTIVE
        </div>
    </div>

    <audio id="bgAudio" loop>
        <source src="https://files.catbox.moe/h8gf56.mp3" type="audio/mpeg">
    </audio>

    <script>
        const audio = document.getElementById('bgAudio');
        const btn = document.getElementById('musicBtn');
        const volContainer = document.getElementById('volumeControl');
        const volSlider = document.getElementById('volume');

        btn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play();
                btn.innerText = 'Terminate Audio';
                volContainer.style.display = 'flex';
            } else {
                audio.pause();
                btn.innerText = 'Initialize Background Audio';
                volContainer.style.display = 'none';
            }
        });

        volSlider.addEventListener('input', (e) => {
            audio.volume = e.target.value;
        });
    </script>
</body>
</html>
  `;
  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(color('🌐 Preview interface active on port ' + PORT, 'cyan'));
});

export default app;
