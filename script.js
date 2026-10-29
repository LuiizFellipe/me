document.addEventListener('DOMContentLoaded', () => {

    // --- DADOS FIXOS ---
    const LINKS = {
        linkedin: 'https://br.linkedin.com/in/luiz-felipe-andrich-567127186',
        github: 'https://github.com/LuiizFellipe',
        email: 'andrich.luiz@gmail.com'
    };

    const WALLPAPERS = [
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1770&q=80',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1773&q=80',
        'https://images.unsplash.com/photo-1550684376-efcbd6e3f031?auto=format&fit=crop&w=1770&q=80',
        'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=1770&q=80'
    ];

    const THEMES = ['dark', 'light', 'matrix'];
    const BOOT_TIME = Date.now();

    // --- ELEMENTOS GLOBAIS ---
    const bootContainerEl = document.getElementById('boot-container');
    const bootLogEl = document.getElementById('boot-log');
    const bootLoaderEl = document.getElementById('boot-loader');
    const bootStatusEl = document.getElementById('boot-status');

    const desktopEl = document.getElementById('desktop-environment');
    const bsodScreenEl = document.getElementById('bsod-screen');
    const shutdownScreenEl = document.getElementById('shutdown-screen');
    const contextMenuEl = document.getElementById('context-menu');
    const toastEl = document.getElementById('toast-notification');
    const matrixCanvasEl = document.getElementById('matrix-canvas');

    let loaderWidth = 0;
    let highestZIndex = 100;
    let inactivityTimer;
    let bootDone = false;
    let bootSkipped = false;
    let spawnOffset = 0;
    let focusedWindowId = null;
    let terminalAPI = null;
    let chatAPI = null;

    // Helper 'sleep'
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    // --- 0. MOTOR DE EFEITOS SONOROS (Web Audio, 100% sintético) ---
    const SFX = (() => {
        let ctx = null;
        let muted = localStorage.getItem('luizos-muted') === 'true';

        function ensureCtx() {
            if (!ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return false;
                ctx = new AC();
            }
            if (ctx.state === 'suspended') {
                try { ctx.resume(); } catch (e) { /* sem gesto do usuário ainda */ }
            }
            return true;
        }

        function tone(freq, dur, type = 'square', vol = 0.03, delay = 0, endFreq = null) {
            if (!ensureCtx()) return;
            if (ctx.state !== 'running') return; // sem gesto: não agenda notas num contexto congelado
            const t = ctx.currentTime + delay;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(vol, t + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + dur + 0.05);
        }

        function play(fn) {
            if (muted) return;
            try { fn(); } catch (e) { /* áudio nunca deve quebrar o site */ }
        }

        return {
            click() { play(() => tone(780, 0.05, 'square', 0.02)); },
            open() { play(() => { tone(420, 0.07, 'sine', 0.04); tone(640, 0.09, 'sine', 0.04, 0.06); }); },
            close() { play(() => { tone(520, 0.07, 'sine', 0.035); tone(330, 0.1, 'sine', 0.035, 0.06); }); },
            minimize() { play(() => tone(600, 0.16, 'sine', 0.035, 0, 220)); },
            key() { play(() => tone(1500 + Math.random() * 700, 0.02, 'square', 0.012)); },
            notify() { play(() => { tone(880, 0.12, 'sine', 0.045); tone(660, 0.18, 'sine', 0.045, 0.13); }); },
            boot() { play(() => { tone(523.25, 0.14, 'sine', 0.05); tone(659.25, 0.14, 'sine', 0.05, 0.12); tone(783.99, 0.24, 'sine', 0.05, 0.24); }); },
            toggleMute() {
                muted = !muted;
                localStorage.setItem('luizos-muted', String(muted));
                if (!muted) this.click();
                return muted;
            },
            isMuted() { return muted; }
        };
    })();

    // --- 1. GERENCIAMENTO DE CONFIGURAÇÕES (localStorage) ---
    function applySavedSettings() {
        try {
            const savedTheme = localStorage.getItem('luizos-theme');
            const theme = THEMES.includes(savedTheme) ? savedTheme : 'dark';
            const accent = localStorage.getItem('luizos-accent') || 'green';
            const crt = localStorage.getItem('luizos-crt') === 'true';
            let wallpaper = localStorage.getItem('luizos-wallpaper');
            if (!WALLPAPERS.includes(wallpaper)) wallpaper = WALLPAPERS[0]; // limpa valores quebrados antigos

            document.body.setAttribute('data-theme', theme);
            document.body.setAttribute('data-accent', accent);
            document.body.setAttribute('data-crt', crt ? 'on' : 'off');
            if (desktopEl) {
                desktopEl.style.backgroundImage = `url('${wallpaper}')`;
            }

            const themeRadio = document.querySelector(`#theme-selector input[value="${theme}"]`);
            if (themeRadio) themeRadio.checked = true;
            const crtToggle = document.getElementById('crt-toggle');
            if (crtToggle) crtToggle.checked = crt;

            document.querySelectorAll('.color-swatch').forEach(sw => {
                sw.classList.toggle('active', sw.dataset.accent === accent);
            });
            document.querySelectorAll('.wallpaper-thumb').forEach(thumb => {
                thumb.classList.toggle('active', thumb.dataset.url === wallpaper);
            });
        } catch (e) {
            // preferências corrompidas nunca podem impedir o boot
        }
    }

    function saveSetting(key, value) {
        localStorage.setItem(`luizos-${key}`, value);
    }

    // --- 2. ANIMAÇÃO DE BOOT (v2: logo ASCII + skip) ---
    const bootLines = [
        "Iniciando LuizOS v2.0 (Kernel: JS/DOM)...",
        "Montando /dev/brain... [OK]",
        "Carregando módulos de criatividade... [OK]",
        "Compilando personalidade... [OK]",
        "Restaurando configurações salvas... [OK]",
        "Pulando verificação de credenciais... [OK]",
        "Status: <span class='success'>Pronto.</span>"
    ];

    async function runBootSequence() {
        for (const line of bootLines) {
            if (bootSkipped) return;
            bootLogEl.innerHTML += `${line}\n`;
            loaderWidth += (100 / bootLines.length);
            bootLoaderEl.style.width = `${loaderWidth}%`;
            bootLogEl.scrollTop = bootLogEl.scrollHeight;
            await sleep(100 + Math.random() * 50);
        }

        bootStatusEl.textContent = "[ BOOT CONCLUÍDO ]";
        await sleep(500);
        startPortfolio();
    }

    function startPortfolio() {
        if (bootDone) return;
        bootDone = true;
        SFX.boot(); // só soa se o visitário já interagiu (política de autoplay); caso contrário é silencioso

        bootContainerEl.style.transition = 'opacity 0.5s ease-out';
        bootContainerEl.style.opacity = '0';

        setTimeout(() => {
            bootContainerEl.style.display = 'none';
            document.title = 'LuizOS | Luiz Felipe Andrich';

            desktopEl.classList.remove('hidden');
            desktopEl.classList.add('visible');
            initDesktop();
        }, 500);
    }

    function initBootSkip() {
        const skip = () => {
            if (bootDone) return;
            bootSkipped = true;
            startPortfolio();
        };
        document.getElementById('boot-skip').addEventListener('click', skip);
        bootContainerEl.addEventListener('click', skip);
        document.addEventListener('keydown', (e) => {
            if (!bootDone && e.key === 'Enter') skip();
        });
    }

    // --- 3. LÓGICA DO DESKTOP ENVIRONMENT ---
    function initDesktop() {
        initStartMenu();
        initWindowManager();
        initSettingsApp();
        terminalAPI = initTerminal();
        chatAPI = initChatApp();
        initClock();
        initContextMenu();
        initShortcuts();
        initParallax();
        initToast();
        initIdeApp();
        initBrowserApp();
        initIconDrag();
        initKonami();
        startInactivityTimer();

        ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            window.addEventListener(event, resetInactivityTimer, { passive: true });
        });
    }

    // --- 4. MENU INICIAR ---
    function initStartMenu() {
        const startButton = document.getElementById('start-button');
        const startMenu = document.getElementById('start-menu');

        startButton.addEventListener('click', (e) => {
            e.stopPropagation();
            SFX.click();
            startMenu.classList.toggle('hidden');
            startButton.classList.toggle('active');
        });

        window.addEventListener('click', (e) => {
            if (!startMenu.classList.contains('hidden') && !startMenu.contains(e.target) && !startButton.contains(e.target)) {
                startMenu.classList.add('hidden');
                startButton.classList.remove('active');
            }
        });

        startMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.start-menu-item');
            if (!item) return;

            const windowId = item.dataset.window;
            if (windowId) {
                openWindow(windowId);
            }

            startMenu.classList.add('hidden');
            startButton.classList.remove('active');
        });

        document.getElementById('restart-button').addEventListener('click', () => {
            location.reload();
        });

        document.getElementById('shutdown-button').addEventListener('click', () => {
            SFX.close();
            shutdownScreenEl.classList.remove('hidden');
            shutdownScreenEl.classList.add('visible');
            setTimeout(() => {
                desktopEl.style.display = 'none';
                bsodScreenEl.style.display = 'none';
                document.body.style.backgroundColor = '#000';
            }, 1000);
            setTimeout(() => {
                window.close();
            }, 2500);
        });
    }

    // --- 5. GERENCIADOR DE JANELAS v2 ---
    function initWindowManager() {
        const icons = document.querySelectorAll('.desktop-icon');
        const windows = document.querySelectorAll('.window');
        const taskbarIconsEl = document.getElementById('taskbar-icons');
        const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

        // Touch: 1 toque abre; mouse: duplo clique (comportamento de OS)
        icons.forEach(icon => {
            icon.addEventListener(coarsePointer ? 'click' : 'dblclick', () => openWindow(icon.dataset.window));
        });

        document.querySelectorAll('.window-close').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                closeWindow(button.dataset.window);
            });
        });
        document.querySelectorAll('.window-btn.minimize').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                minimizeWindow(button.dataset.window);
            });
        });
        document.querySelectorAll('.window-btn.maximize').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleMaximize(button.dataset.window);
            });
        });

        windows.forEach(windowEl => {
            windowEl.addEventListener('pointerdown', () => focusWindow(windowEl));
        });
        makeWindowsDraggable();

        taskbarIconsEl.addEventListener('click', (e) => {
            const icon = e.target.closest('.taskbar-app-icon');
            if (!icon) return;
            const windowId = icon.dataset.window;
            const windowEl = document.getElementById(windowId);

            if (windowEl.classList.contains('hidden')) restoreWindow(windowId);
            else if (focusedWindowId === windowId) minimizeWindow(windowId);
            else focusWindow(windowEl);
        });

        // Botão de som
        const soundToggle = document.getElementById('sound-toggle');
        const updateSoundIcon = () => {
            soundToggle.textContent = SFX.isMuted() ? '🔇' : '🔊';
        };
        updateSoundIcon();
        soundToggle.addEventListener('click', () => {
            SFX.toggleMute();
            updateSoundIcon();
        });
    }

    function openWindow(windowId, options = {}) {
        const windowEl = document.getElementById(windowId);
        if (!windowEl) return;

        // Primeira abertura: posição em cascata (janelas não nascem mais empilhadas)
        if (!windowEl.dataset.spawned) {
            const step = spawnOffset % 7;
            windowEl.style.left = `${60 + step * 32}px`;
            windowEl.style.top = `${55 + step * 24}px`;
            windowEl.dataset.spawned = 'true';
            spawnOffset++;
        }

        // cancela uma animação de fechamento/minimização em andamento (corrida fechar→reabrir)
        if (windowEl._transitionTimer) {
            clearTimeout(windowEl._transitionTimer);
            windowEl._transitionTimer = null;
        }
        windowEl.classList.remove('closing', 'minimizing');
        windowEl.classList.remove('hidden');
        windowEl.classList.add('opening');
        setTimeout(() => windowEl.classList.remove('opening'), 220);
        focusWindow(windowEl);

        if (!document.querySelector(`.taskbar-app-icon[data-window="${windowId}"]`)) {
            const iconData = getWindowIconData(windowId);
            const iconEl = document.createElement('div');
            iconEl.className = 'taskbar-app-icon active';
            iconEl.dataset.window = windowId;
            iconEl.innerHTML = `<img src="${iconData.src}" alt="${iconData.alt}"> <span>${iconData.title}</span>`;
            document.getElementById('taskbar-icons').appendChild(iconEl);
        } else {
            document.querySelector(`.taskbar-app-icon[data-window="${windowId}"]`).classList.add('active');
        }

        if (!options.silent) SFX.open();
        if (windowId === 'terminal-window') document.getElementById('terminal-input').focus();
        if (windowId === 'snake-window') Snake.resume();
        if (windowId === 'chat-window' && chatAPI) chatAPI.start();
        const openAchievements = { 'ide-window': 'ide', 'browser-window': 'browser', 'chat-window': 'chat' };
        if (openAchievements[windowId]) Achievements.unlock(openAchievements[windowId]);
    }

    function closeWindow(windowId) {
        const windowEl = document.getElementById(windowId);
        if (!windowEl || windowEl.classList.contains('hidden')) return;
        SFX.close();
        if (windowId === 'snake-window') Snake.pause();
        if (windowId === 'chat-window' && chatAPI) chatAPI.cancel();

        windowEl.classList.add('closing');
        windowEl._transitionTimer = setTimeout(() => {
            windowEl.classList.add('hidden');
            windowEl.classList.remove('closing');
            windowEl._transitionTimer = null;
            if (focusedWindowId === windowId) focusedWindowId = null;
        }, 150);

        const taskbarIcon = document.querySelector(`.taskbar-app-icon[data-window="${windowId}"]`);
        if (taskbarIcon) taskbarIcon.classList.remove('active');
    }

    function minimizeWindow(windowId) {
        const windowEl = document.getElementById(windowId);
        if (!windowEl || windowEl.classList.contains('hidden')) return;
        SFX.minimize();
        if (windowId === 'snake-window') Snake.pause();

        windowEl.classList.add('minimizing');
        windowEl._transitionTimer = setTimeout(() => {
            windowEl.classList.add('hidden');
            windowEl.classList.remove('minimizing');
            windowEl._transitionTimer = null;
            if (focusedWindowId === windowId) focusedWindowId = null;
        }, 180);

        const taskbarIcon = document.querySelector(`.taskbar-app-icon[data-window="${windowId}"]`);
        if (taskbarIcon) taskbarIcon.classList.remove('active');
    }

    function restoreWindow(windowId) {
        openWindow(windowId);
    }

    function toggleMaximize(windowId) {
        const windowEl = document.getElementById(windowId);
        if (!windowEl) return;
        SFX.click();
        if (windowEl.classList.contains('maximized')) {
            windowEl.classList.remove('maximized');
            const prev = JSON.parse(windowEl.dataset.prevSize || '{}');
            if (prev.width) windowEl.style.width = prev.width;
            if (prev.height) windowEl.style.height = prev.height;
        } else {
            windowEl.dataset.prevSize = JSON.stringify({
                width: windowEl.style.width,
                height: windowEl.style.height
            });
            windowEl.classList.add('maximized');
        }
    }

    function focusWindow(windowEl) {
        highestZIndex++;
        windowEl.style.zIndex = highestZIndex;
        focusedWindowId = windowEl.id;
        document.querySelectorAll('.taskbar-app-icon').forEach(icon => icon.classList.remove('active'));
        const taskbarIcon = document.querySelector(`.taskbar-app-icon[data-window="${windowEl.id}"]`);
        if (taskbarIcon) taskbarIcon.classList.add('active');
    }

    function getWindowIconData(windowId) {
        const desktopIcon = document.querySelector(`.desktop-icon[data-window="${windowId}"]`);
        return {
            src: desktopIcon.querySelector('img').src,
            alt: desktopIcon.querySelector('img').alt,
            title: desktopIcon.querySelector('span').textContent.replace('.exe', '').replace('.txt', '')
        };
    }

    function makeWindowsDraggable() {
        document.querySelectorAll('.window-header').forEach(header => {
            let activeWindow = null, offset = { x: 0, y: 0 };

            header.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.window-btn, .window-close')) return;
                const win = header.closest('.window');
                if (win.classList.contains('maximized')) return;
                activeWindow = win;
                focusWindow(win);
                const rect = win.getBoundingClientRect();
                offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                header.setPointerCapture(e.pointerId);
            });

            header.addEventListener('pointermove', (e) => {
                if (!activeWindow) return;
                let newX = e.clientX - offset.x, newY = e.clientY - offset.y;
                const taskbarHeight = document.getElementById('taskbar').offsetHeight;
                newY = Math.max(0, Math.min(newY, window.innerHeight - taskbarHeight - 20));
                newX = Math.max(0, Math.min(newX, window.innerWidth - activeWindow.offsetWidth));
                activeWindow.style.left = `${newX}px`;
                activeWindow.style.top = `${newY}px`;
            });

            header.addEventListener('pointerup', () => { activeWindow = null; });
            header.addEventListener('pointercancel', () => { activeWindow = null; });
        });
    }

    // --- 6. APP DE CONFIGURAÇÕES ---
    function initSettingsApp() {
        const themeSelector = document.getElementById('theme-selector');
        const accentSelector = document.getElementById('accent-selector');
        const wallpaperSelector = document.getElementById('wallpaper-selector');
        const crtToggle = document.getElementById('crt-toggle');

        themeSelector.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });

        accentSelector.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            const accent = swatch.dataset.accent;
            document.body.setAttribute('data-accent', accent);
            saveSetting('accent', accent);
            accentSelector.querySelector('.active')?.classList.remove('active');
            swatch.classList.add('active');
            SFX.click();
        });

        wallpaperSelector.addEventListener('click', (e) => {
            const thumb = e.target.closest('.wallpaper-thumb');
            if (!thumb) return;
            setWallpaper(thumb.dataset.url);
            SFX.click();
        });

        crtToggle.addEventListener('change', () => {
            const on = crtToggle.checked;
            document.body.setAttribute('data-crt', on ? 'on' : 'off');
            saveSetting('crt', String(on));
            SFX.click();
        });
    }

    function applyTheme(theme) {
        if (!THEMES.includes(theme)) return;
        document.body.setAttribute('data-theme', theme);
        saveSetting('theme', theme);
        const themeRadio = document.querySelector(`#theme-selector input[value="${theme}"]`);
        if (themeRadio) themeRadio.checked = true;
        SFX.click();
    }

    function setWallpaper(url) {
        if (!WALLPAPERS.includes(url)) return;
        desktopEl.style.backgroundImage = `url('${url}')`;
        saveSetting('wallpaper', url);
        document.querySelectorAll('.wallpaper-thumb').forEach(thumb => {
            thumb.classList.toggle('active', thumb.dataset.url === url);
        });
    }

    // --- 7. RELÓGIO ---
    function initClock() {
        const clockEl = document.getElementById('clock');
        function updateClock() {
            const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            clockEl.textContent = time;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    // --- 8. TERMINAL v2 ---
    function initTerminal() {
        const terminalOutputEl = document.getElementById('terminal-output');
        const terminalInputEl = document.getElementById('terminal-input');
        const terminalBodyEl = document.getElementById('terminal-body');

        if (!terminalBodyEl) return { run: () => {} };

        const commandHistory = [];
        let historyIndex = -1;

        const projects = {
            "vetpilot": { title: "VetPilot", description: "Sistema de chat com IA, exames, aulas e simulados para veterinária.", tech: "[ Next.js, Supabase, Postgres, AI ]", link: "https://vetpilot.veteduka.com.br/" },
            "wcheck": { title: "W Check Brasil", description: "Maior plataforma de consulta veicular e análise de crédito do Brasil (+13k clientes).", tech: "[ Next.js, NestJS, Postgres, AWS ]", link: "https://app.wcheckbrasil.com.br" },
            "pupify": { title: "Pupify", description: "Gestão de clínicas veterinárias com IA que cria prontuários em tempo real durante as consultas.", tech: "[ Next.js, TypeScript, Fastify, Postgres, AI ]", link: "https://app.pupify.com.br/" },
            "checkdomus": { title: "CheckDomus", description: "Sistema de vistorias construído com arquitetura moderna.", tech: "[ Fastify, TypeScript, PostgreSQL, Next.js ]", link: "https://app.checkdomus.com.br" },
            "portfolio-os": { title: "Este Portfólio (Meta!)", description: "O próprio portfólio que você está usando, como um mini-OS no navegador.", tech: "[ Vanilla JavaScript, HTML5, CSS ]", link: "https://github.com/LuiizFellipe/me" }
        };
        const files = {
            'about.txt': `Olá! Sou o Luiz Felipe Andrich.
Um desenvolvedor focado em lógica, performance e em entregar algo que os usuários *realmente* queiram usar.`,
            'contact.sh': `#!/bin/bash
echo "LinkedIn: ${LINKS.linkedin}"
echo "GitHub:   ${LINKS.github}"
echo "Email:    ${LINKS.email}"`
        };
        const commands = {
            'help': `<span class="highlight">Comandos:</span> neofetch, skills, projects, ls, cat [arquivo], contact, whoami, date, theme [nome], open [app], snake, matrix, hack, bsod, sudo, clear
<span class="highlight">Atalhos:</span> Ctrl+\` abre o terminal · Esc minimiza a janela focada · Alt+Q troca de janela`,
            'neofetch': () => `<span class="neofetch-ascii">┌─────────────┐
│  ❯ LuizOS_  │
│             │
└──┬───────┬──┘
   │       │</span>
<div class="neofetch-info"><span class="info-label">Usuário</span><span class="info-value">luiz_felipe_andrich</span></div>
<div class="neofetch-info"><span class="info-label">OS</span><span class="info-value">LuizOS v2.0</span></div>
<div class="neofetch-info"><span class="info-label">Host</span><span class="info-value">luizfelipe.dev.br</span></div>
<div class="neofetch-info"><span class="info-label">Uptime</span><span class="info-value">${Math.round((Date.now() - BOOT_TIME) / 1000)}s</span></div>
<div class="neofetch-info"><span class="info-label">Foco</span><span class="info-value">Fullstack, Arquitetura</span></div>`,
            'skills': `<span class="highlight">//--- FRONTEND ---//</span>
  ▹ TypeScript, Next.js, Nuxt.js
<span class="highlight">//--- BACKEND ---//</span>
  ▹ NestJS, Fastify, Supabase, N8n, RabbitMQ, Redis
<span class="highlight">//--- DEVOPS & INFRA ---//</span>
  ▹ Docker, VPS, DevOps`,
            'projects': `Projetos: <span class="project-title">vetpilot</span>, <span class="project-title">wcheck</span>, <span class="project-title">pupify</span>, <span class="project-title">checkdomus</span>, <span class="project-title">portfolio-os</span>.
Digite <span class='highlight'>projects [nome]</span> para detalhes.`,
            'ls': `<span class="ls-dir">projects/</span>  <span class="ls-file">about.txt</span>  <span class="ls-exec">contact.sh</span>`,
            'contact': `LinkedIn: <a href="${LINKS.linkedin}" target="_blank" rel="noopener">${LINKS.linkedin}</a>
GitHub:   <a href="${LINKS.github}" target="_blank" rel="noopener">${LINKS.github}</a>
Email:    <a href="mailto:${LINKS.email}">${LINKS.email}</a>`,
            'whoami': 'luiz_felipe_andrich (O dev que você estava procurando)',
            'date': () => `Hoje é ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}... Hora de me contratar.`,
            'cat': 'Uso: cat [arquivo] — disponíveis: about.txt, contact.sh',
            'open': 'Uso: open [app] — apps: about, projects, terminal, settings, snake, ide, browser, chat',
            'theme': 'Uso: theme [nome] — temas: dark, light, matrix',
            'clear': '',
            'sudo': '<span class="error">Acesso negado.</span> Mas legal você ter tentado. 😉 (dica: tente <span class="highlight">sudo hire-luiz</span>)',
            'sudo hire-luiz': '<span class="success">PRIVILÉGIOS CONCEDIDOS.</span> Recrutador detectado. Execute <span class="highlight">contact</span> para completar a operação. 🚀',
            'sudo rm -rf /': '<span class="warn">Quase!</span> Sistema protegido.'
        };
        const commandNames = ['help', 'neofetch', 'skills', 'projects', 'ls', 'cat', 'contact', 'whoami', 'date', 'theme', 'open', 'matrix', 'hack', 'bsod', 'snake', 'sudo', 'clear'];
        const appAliases = {
            about: 'about-window', sobre: 'about-window',
            projects: 'projects-window', projetos: 'projects-window',
            terminal: 'terminal-window',
            settings: 'settings-window', configuracoes: 'settings-window',
            snake: 'snake-window', game: 'snake-window',
            ide: 'ide-window', code: 'ide-window',
            browser: 'browser-window', navegador: 'browser-window',
            chat: 'chat-window', whatsapp: 'chat-window'
        };

        terminalBodyEl.addEventListener('click', () => terminalInputEl.focus());
        terminalInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = terminalInputEl.value.trim().toLowerCase();
                if (command) {
                    commandHistory.push(command);
                    historyIndex = commandHistory.length;
                    run(command);
                    terminalInputEl.value = '';
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (commandHistory.length > 0) {
                    historyIndex = Math.max(0, historyIndex - 1);
                    terminalInputEl.value = commandHistory[historyIndex] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex < commandHistory.length) {
                    historyIndex++;
                    terminalInputEl.value = commandHistory[historyIndex] || '';
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                const partial = terminalInputEl.value.trim().toLowerCase();
                if (partial) {
                    const match = commandNames.find(c => c.startsWith(partial));
                    if (match) terminalInputEl.value = match + ' ';
                }
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                SFX.key();
            }
        });

        function run(command) {
            logToTerminal(command, 'command');
            processCommand(command);
        }

        async function processCommand(command) {
            if (command === 'clear') { terminalOutputEl.innerHTML = ''; return; }
            if (command === 'sudo hire-luiz') Achievements.unlock('hire');
            if (command === 'matrix') {
                MatrixRain.toggle();
                Achievements.unlock('matrix');
                logToTerminal(MatrixRain.isActive() ? '<span class="success">Bem-vindo à Matrix...</span> (digite matrix de novo para sair)' : 'Voltei ao mundo real.', 'response');
                return;
            }
            if (command === 'bsod') {
                logToTerminal('Causando falha crítica propositadamente em 3... 2... 1...', 'response');
                setTimeout(showBSOD, 1200);
                return;
            }
            if (command === 'hack') { await runHackSequence(); return; }
            if (command === 'snake') {
                openWindow('snake-window');
                logToTerminal('Iniciando Snake.exe... Use as setas. Não me responsabilizo pela produtividade perdida.', 'response');
                return;
            }
            if (command.startsWith('open ')) {
                const alias = command.split(' ')[1];
                const windowId = appAliases[alias];
                if (windowId) {
                    openWindow(windowId);
                    logToTerminal(`Abrindo ${escapeHTML(alias)}...`, 'response');
                } else {
                    logToTerminal(`<span class="error">App '${escapeHTML(alias)}' não encontrado.</span> Apps: ${Object.keys(appAliases).join(', ')}`, 'response');
                }
                return;
            }
            if (command.startsWith('theme ')) {
                const theme = command.split(' ')[1];
                if (THEMES.includes(theme)) {
                    applyTheme(theme);
                    logToTerminal(`Tema alterado para <span class="highlight">${escapeHTML(theme)}</span>.`, 'response');
                } else {
                    logToTerminal(`Temas disponíveis: ${THEMES.join(', ')}`, 'response');
                }
                return;
            }
            if (command.startsWith('projects ')) {
                const pName = command.split(' ')[1];
                const p = Object.hasOwn(projects, pName) ? projects[pName] : null;
                logToTerminal(p ? `Carregando <span class="project-title">${p.title}</span>...
  <span class="highlight">Descrição:</span> ${p.description}
  <span class="highlight">Stack:</span>     ${p.tech}
  <span class="highlight">Link:</span> <a href="${p.link}" target="_blank" rel="noopener">${p.link}</a>`
                    : `<span class="error">Projeto '${escapeHTML(pName)}' não encontrado.</span> Digite 'projects' para a lista.`, 'response');
                return;
            }
            if (command.startsWith('cat ')) {
                const fName = command.split(' ')[1];
                logToTerminal(Object.hasOwn(files, fName) ? files[fName] : `<span class="error">cat:</span> '${escapeHTML(fName)}': Arquivo não encontrado.`, 'response');
                return;
            }

            const entry = commands[command];
            const response = typeof entry === 'function' ? entry() : entry;
            logToTerminal(response ?? `<span class="error">Comando não encontrado:</span> <span class="highlight">${escapeHTML(command)}</span>. Digite 'help'.`, 'response');
        }

        async function runHackSequence() {
            const steps = [
                'Iniciando sequência de invasão... <span class="success">[OK]</span>',
                'Bypass do firewall... <span class="success">[OK]</span>',
                'Decodificando senhas do pentágono... <span class="success">[OK]</span>',
                'Acessando o mainframe... <span class="error">[ERRO: PERMISSÃO NEGADA]</span>',
                '...',
                '<span class="warn">Erro 418: Eu sou um bule. 🫖</span>',
                'Dica real: digite <span class="highlight">contact</span> e me contrate antes que eu aprenda a hackear de verdade.'
            ];
            for (const step of steps) {
                await logToTerminal(step, 'response');
                await sleep(350);
            }
            Achievements.unlock('hack');
        }

        async function logToTerminal(text, typeClass) {
            const lineEl = document.createElement('div');
            lineEl.className = `terminal-output-line ${typeClass}`;
            if (typeClass === 'command') {
                // O comando digitado entra como texto puro (textContent) — nunca como HTML
                const prefixEl = document.createElement('span');
                prefixEl.className = 'prompt-prefix';
                prefixEl.textContent = 'luiz@portfolio:~$';
                const textEl = document.createElement('span');
                textEl.textContent = ` ${text}`;
                lineEl.append(prefixEl, textEl);
                terminalOutputEl.appendChild(lineEl);
            } else {
                lineEl.innerHTML = '';
                terminalOutputEl.appendChild(lineEl);
                let i = 0;
                while (i < text.length) {
                    let char = text.charAt(i);
                    if (char === '<') {
                        const tagEnd = text.indexOf('>', i);
                        if (tagEnd !== -1) { lineEl.innerHTML += text.substring(i, tagEnd + 1); i = tagEnd; }
                        else { lineEl.innerHTML += char; }
                    } else { lineEl.innerHTML += char; }
                    i++;
                    terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
                    if (i < text.length) await sleep(4);
                }
            }
            terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
        }

        logToTerminal(`Bem-vindo ao <span class="highlight">LuizOS v2.0</span>. Digite 'help'.`, 'response');

        return { run };
    }

    // --- 9. CHUVA DE MATRIX (canvas) ---
    const MatrixRain = (() => {
        let ctx = null, animId = null, active = false, frame = 0, resizeHandler = null;
        const chars = 'アイウエオカキクケコサシスセソ0123456789';

        function start() {
            ctx = matrixCanvasEl.getContext('2d');
            matrixCanvasEl.width = window.innerWidth;
            matrixCanvasEl.height = window.innerHeight;
            const fontSize = 15;
            let drops = Array.from({ length: Math.ceil(matrixCanvasEl.width / fontSize) }, () => Math.random() * -60);
            const color = getComputedStyle(document.body).getPropertyValue('--highlight').trim() || '#39D353';

            active = true;
            matrixCanvasEl.classList.remove('hidden');
            requestAnimationFrame(() => matrixCanvasEl.classList.add('visible'));

            resizeHandler = () => {
                matrixCanvasEl.width = window.innerWidth;
                matrixCanvasEl.height = window.innerHeight;
                drops = Array.from({ length: Math.ceil(matrixCanvasEl.width / fontSize) }, () => Math.random() * -60);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
                ctx.fillRect(0, 0, matrixCanvasEl.width, matrixCanvasEl.height);
            };
            window.addEventListener('resize', resizeHandler);

            function draw() {
                if (!active) return;
                animId = requestAnimationFrame(draw);
                frame++;
                if (frame % 2 !== 0) return; // ~30fps
                ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
                ctx.fillRect(0, 0, matrixCanvasEl.width, matrixCanvasEl.height);
                ctx.fillStyle = color;
                ctx.font = `${fontSize}px 'Space Mono', monospace`;
                drops.forEach((y, i) => {
                    const text = chars.charAt(Math.floor(Math.random() * chars.length));
                    ctx.fillText(text, i * fontSize, y * fontSize);
                    if (y * fontSize > matrixCanvasEl.height && Math.random() > 0.975) drops[i] = 0;
                    drops[i]++;
                });
            }
            draw();
        }

        function stop() {
            active = false;
            matrixCanvasEl.classList.remove('visible');
            if (animId) cancelAnimationFrame(animId);
            if (resizeHandler) {
                window.removeEventListener('resize', resizeHandler);
                resizeHandler = null;
            }
            setTimeout(() => {
                if (!active) {
                    matrixCanvasEl.classList.add('hidden');
                    if (ctx) ctx.clearRect(0, 0, matrixCanvasEl.width, matrixCanvasEl.height);
                }
            }, 400);
        }

        return {
            toggle() { active ? stop() : start(); },
            isActive() { return active; }
        };
    })();

    // --- 10. MENU DE CONTEXTO (botão direito) ---
    function initContextMenu() {
        desktopEl.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.window, #taskbar, #start-menu')) return; // mantém o menu nativo dentro das janelas
            e.preventDefault();
            contextMenuEl.classList.remove('hidden');
            const x = Math.min(e.clientX, window.innerWidth - 230);
            const y = Math.min(e.clientY, window.innerHeight - 200);
            contextMenuEl.style.left = `${x}px`;
            contextMenuEl.style.top = `${y}px`;
        });

        window.addEventListener('click', (e) => {
            if (!contextMenuEl.classList.contains('hidden') && !contextMenuEl.contains(e.target)) {
                contextMenuEl.classList.add('hidden');
            }
        });
        window.addEventListener('blur', hideContextMenu);

        contextMenuEl.addEventListener('click', (e) => {
            const item = e.target.closest('.context-item');
            if (!item) return;
            hideContextMenu();

            switch (item.dataset.action) {
                case 'next-wallpaper': {
                    const current = WALLPAPERS.findIndex(url => desktopEl.style.backgroundImage.includes(url.split('?')[0]));
                    const next = WALLPAPERS[(current + 1 + WALLPAPERS.length) % WALLPAPERS.length];
                    setWallpaper(next);
                    break;
                }
                case 'toggle-theme': {
                    const current = THEMES.indexOf(document.body.getAttribute('data-theme'));
                    applyTheme(THEMES[(current + 1) % THEMES.length]);
                    break;
                }
                case 'open-terminal':
                    openWindow('terminal-window');
                    break;
                case 'organize-icons':
                    document.dispatchEvent(new Event('luizos:organize-icons'));
                    break;
                case 'reload':
                    location.reload();
                    break;
                case 'about-os':
                    openWindow('about-window');
                    break;
            }
        });

        function hideContextMenu() {
            contextMenuEl.classList.add('hidden');
        }
    }

    // --- 11. ATALHOS DE TECLADO GLOBAIS ---
    function initShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+` (Backquote): abre/fecha o terminal
            if ((e.ctrlKey || e.metaKey) && e.code === 'Backquote') {
                e.preventDefault();
                const terminalWindow = document.getElementById('terminal-window');
                if (terminalWindow.classList.contains('hidden')) openWindow('terminal-window');
                else closeWindow('terminal-window');
                return;
            }
            // Alt+Q: cicla entre as janelas abertas
            if (e.altKey && e.code === 'KeyQ') {
                e.preventDefault();
                cycleWindows();
                return;
            }
            // Esc: fecha menu de contexto → menu iniciar → minimiza a janela focada
            if (e.key === 'Escape') {
                if (!contextMenuEl.classList.contains('hidden')) {
                    contextMenuEl.classList.add('hidden');
                    return;
                }
                const startMenu = document.getElementById('start-menu');
                if (!startMenu.classList.contains('hidden')) {
                    startMenu.classList.add('hidden');
                    document.getElementById('start-button').classList.remove('active');
                    return;
                }
                if (focusedWindowId) minimizeWindow(focusedWindowId);
            }
        });
    }

    function cycleWindows() {
        const open = Array.from(document.querySelectorAll('.window:not(.hidden)'))
            .sort((a, b) => (parseInt(b.style.zIndex) || 0) - (parseInt(a.style.zIndex) || 0));
        if (open.length === 0) return;
        // foca a mais baixa da pilha: ela sobe ao topo e o próximo ciclo alcança todas
        focusWindow(open[open.length - 1]);
    }

    // --- 12. PARALLAX SUTIL DO PAPEL DE PAREDE ---
    function initParallax() {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
        if (reducedMotion || coarsePointer) return;

        let rafPending = false;
        desktopEl.addEventListener('mousemove', (e) => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                const dx = (e.clientX / window.innerWidth - 0.5) * 6;
                const dy = (e.clientY / window.innerHeight - 0.5) * 6;
                desktopEl.style.backgroundPosition = `${50 + dx}% ${50 + dy}%`;
                rafPending = false;
            });
        });
    }

    // --- 13. NOTIFICAÇÃO FAKE NA TASKBAR ---
    function initToast() {
        setTimeout(() => {
            if (sessionStorage.getItem('luizos-toast-shown')) return;
            sessionStorage.setItem('luizos-toast-shown', '1');
            toastEl.classList.remove('hidden');
            SFX.notify();
            const autoHide = setTimeout(hideToast, 12000);
            toastEl.addEventListener('click', (e) => {
                if (e.target.closest('.toast-close')) {
                    clearTimeout(autoHide);
                    hideToast();
                    return;
                }
                clearTimeout(autoHide);
                hideToast();
                openWindow('terminal-window');
                terminalAPI.run('contact');
            });
        }, 18000);

        function hideToast() {
            toastEl.classList.add('hidden');
        }
    }

    // --- 14. SNAKE.EXE ---
    const Snake = (() => {
        const CELL = 20, COLS = 22, ROWS = 21;
        let canvas, ctx2d, scoreEl, highEl;
        let snake, dir, nextDir, food, score, timer = null, paused = false, gameOver = false;
        let initialized = false;

        const highScoreKey = 'luizos-snake-high';

        function init() {
            if (initialized) return;
            initialized = true;
            canvas = document.getElementById('snake-canvas');
            ctx2d = canvas.getContext('2d');
            scoreEl = document.getElementById('snake-score');
            highEl = document.getElementById('snake-high');
            highEl.textContent = `Recorde: ${localStorage.getItem(highScoreKey) || 0}`;
            reset();

            document.addEventListener('keydown', (e) => {
                const snakeWindow = document.getElementById('snake-window');
                if (!snakeWindow || snakeWindow.classList.contains('hidden')) return;
                if (focusedWindowId !== 'snake-window') return; // só captura teclas com o jogo em foco
                if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

                const dirMap = {
                    ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
                    ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
                    ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
                    ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 }
                };
                if (dirMap[e.code]) {
                    e.preventDefault();
                    setDirection(dirMap[e.code]);
                } else if (e.code === 'Space') {
                    e.preventDefault();
                    if (gameOver) { reset(); startLoop(); }
                    else togglePause();
                }
            });

            document.querySelectorAll('.snake-dpad button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const dirMap = {
                        up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
                        left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
                    };
                    setDirection(dirMap[btn.dataset.dir]);
                });
            });

            // toque/clique no tabuleiro pausa, retoma ou reinicia
            canvas.addEventListener('click', () => {
                const snakeWindow = document.getElementById('snake-window');
                if (!snakeWindow || snakeWindow.classList.contains('hidden')) return;
                if (gameOver) { reset(); startLoop(); return; }
                togglePause();
            });
        }

        function reset() {
            snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
            dir = { x: 1, y: 0 };
            nextDir = dir;
            score = 0;
            paused = false;
            gameOver = false;
            spawnFood();
            updateHud();
            draw();
        }

        function setDirection(d) {
            if (d.x === -dir.x && d.y === -dir.y) return; // não deixa inverter 180°
            nextDir = d;
        }

        function spawnFood() {
            const free = [];
            for (let x = 0; x < COLS; x++) {
                for (let y = 0; y < ROWS; y++) {
                    if (!snake.some(s => s.x === x && s.y === y)) free.push({ x, y });
                }
            }
            food = free[Math.floor(Math.random() * free.length)] || food;
        }

        function tick() {
            dir = nextDir;
            const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

            const willEat = head.x === food.x && head.y === food.y;
            const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
            // sem comer, a cauda sai da célula neste tick: não conta como colisão
            const bodyToCheck = willEat ? snake : snake.slice(0, -1);
            const hitSelf = bodyToCheck.some(s => s.x === head.x && s.y === head.y);
            if (hitWall || hitSelf) {
                gameOver = true;
                pauseLoop();
                updateHighScore();
                draw();
                return;
            }

            snake.unshift(head);
            if (willEat) {
                score++;
                if (score === 5) Achievements.unlock('snake5');
                SFX.key();
                spawnFood();
                updateHud();
                clearInterval(timer);
                startLoop(); // acelera conforme a pontuação
            } else {
                snake.pop();
            }
            draw();
        }

        function startLoop() {
            clearInterval(timer);
            const interval = Math.max(65, 120 - score * 3);
            timer = setInterval(tick, interval);
        }

        function pauseLoop() {
            clearInterval(timer);
            timer = null;
        }

        function togglePause() {
            paused = !paused;
            if (paused) pauseLoop(); else startLoop();
            draw();
        }

        function updateHud() {
            scoreEl.textContent = `Score: ${score}`;
        }

        function updateHighScore() {
            const high = parseInt(localStorage.getItem(highScoreKey) || 0, 10);
            if (score > high) {
                localStorage.setItem(highScoreKey, String(score));
                highEl.textContent = `Recorde: ${score}`;
            }
        }

        function getThemeColor(varName, fallback) {
            return getComputedStyle(document.body).getPropertyValue(varName).trim() || fallback;
        }

        function draw() {
            const bg = getThemeColor('--terminal-bg', '#010409');
            const highlight = getThemeColor('--highlight', '#39D353');
            const text = getThemeColor('--text-color', '#C9D1D9');
            const secondary = getThemeColor('--text-secondary', '#8B949E');

            ctx2d.fillStyle = bg;
            ctx2d.fillRect(0, 0, canvas.width, canvas.height);

            // comida
            ctx2d.fillStyle = highlight;
            ctx2d.beginPath();
            ctx2d.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
            ctx2d.fill();

            // cobra
            snake.forEach((s, i) => {
                ctx2d.fillStyle = i === 0 ? text : highlight;
                ctx2d.globalAlpha = i === 0 ? 1 : Math.max(0.4, 1 - i * 0.02);
                ctx2d.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
            });
            ctx2d.globalAlpha = 1;

            if (gameOver) {
                ctx2d.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx2d.fillRect(0, 0, canvas.width, canvas.height);
                ctx2d.fillStyle = highlight;
                ctx2d.font = "700 28px 'Space Mono', monospace";
                ctx2d.textAlign = 'center';
                ctx2d.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
                ctx2d.fillStyle = secondary;
                ctx2d.font = "14px 'Space Mono', monospace";
                ctx2d.fillText(`Pontuação: ${score} · Espaço para reiniciar`, canvas.width / 2, canvas.height / 2 + 20);
            } else if (paused) {
                ctx2d.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx2d.fillRect(0, 0, canvas.width, canvas.height);
                ctx2d.fillStyle = text;
                ctx2d.font = "700 22px 'Space Mono', monospace";
                ctx2d.textAlign = 'center';
                ctx2d.fillText('PAUSADO', canvas.width / 2, canvas.height / 2);
            }
        }

        return {
            resume() {
                init();
                if (gameOver) { reset(); startLoop(); return; }
                if (!timer && !paused) startLoop();
            },
            pause() {
                pauseLoop();
            }
        };
    })();

    // --- 15. CONQUISTAS ---
    const Achievements = (() => {
        const KEY = 'luizos-achievements';
        const DEFS = {
            ide: 'Código aberto — você entrou na Luiz IDE',
            browser: 'Explorador — navegou na LuizNet',
            chat: 'Social — conversou com o Luiz Bot',
            matrix: 'Hacker — você entrou na Matrix',
            hack: 'Script kiddie — rodou a sequência de invasão',
            hire: 'RH detector — descobriu o sudo hire-luiz',
            snake5: 'Dedos rápidos — 5+ pontos no Snake',
            konami: 'Cheat code — Konami aceito!'
        };

        function list() {
            try {
                const v = JSON.parse(localStorage.getItem(KEY) || '[]');
                return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
            } catch (e) { return []; }
        }
        const seen = new Set(list());

        function show(title) {
            SFX.notify();
            const toast = document.createElement('div');
            toast.className = 'achievement-toast';
            toast.innerHTML = '<span class="ach-icon">🏆</span><span class="ach-text"><strong>Conquista desbloqueada</strong><span class="ach-title"></span></span>';
            toast.querySelector('.ach-title').textContent = title;
            const stack = document.querySelectorAll('.achievement-toast:not(.out)').length;
            toast.style.top = (18 + stack * 74) + 'px';
            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('out'), 3800);
            setTimeout(() => toast.remove(), 4400);
        }

        function unlock(id) {
            if (!DEFS[id] || seen.has(id)) return;
            seen.add(id);
            const got = list();
            got.push(id);
            try { localStorage.setItem(KEY, JSON.stringify(got)); } catch (e) { /* storage bloqueado */ }
            show(DEFS[id]);
        }

        return { unlock };
    })();

    // --- 16. LUIZ IDE (Code.js) ---
    const IDE_FILES = {
        'sobre.js': `const luiz = {
  nome: "Luiz Felipe Andrich",
  role: "AI Engineer & Fullstack Dev",
  stack: ["TypeScript", "Next.js", "NestJS", "Supabase"],
  filosofia: "a ferramenta certa para cada problema",
  contratar: () => "a melhor decisao da sua sprint"
};`,
        'contato.sh': `#!/bin/bash
echo "LinkedIn: ${LINKS.linkedin}"
echo "GitHub:   ${LINKS.github}"
echo "Email:    ${LINKS.email}"
# aberto a oportunidades`
    };
    const PLAYGROUND_DEFAULT = `// Escreva JavaScript e clique em RUN
console.log("Ola, visitante! 👋");

const stack = ["TypeScript", "Next.js", "NestJS", "Supabase"];
stack.forEach((tech, i) => console.log("Stack[" + i + "]:", tech));`;

    function highlightCode(code) {
        const pattern = /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(const|let|var|function|return|if|else|for|while|new|echo|async|await)\b|(\d+)/g;
        let out = '', last = 0, m;
        while ((m = pattern.exec(code)) !== null) {
            out += escapeHTML(code.slice(last, m.index));
            const cls = m[1] ? 'tok-com' : m[2] ? 'tok-str' : m[3] ? 'tok-kw' : 'tok-num';
            out += '<span class="' + cls + '">' + escapeHTML(m[0]) + '</span>';
            last = m.index + m[0].length;
        }
        out += escapeHTML(code.slice(last));
        return out;
    }

    function initIdeApp() {
        const codeEl = document.getElementById('ide-code');
        const editorEl = document.getElementById('ide-editor');
        const playgroundEl = document.getElementById('ide-playground');
        const consoleEl = document.getElementById('ide-console');
        if (!codeEl) return;

        playgroundEl.value = PLAYGROUND_DEFAULT;

        function openFile(name) {
            document.querySelectorAll('.ide-tab').forEach(t => t.classList.toggle('active', t.dataset.file === name));
            if (name === 'playground.js') {
                editorEl.classList.add('hidden');
                playgroundEl.classList.remove('hidden');
            } else {
                playgroundEl.classList.add('hidden');
                editorEl.classList.remove('hidden');
                codeEl.innerHTML = highlightCode(IDE_FILES[name] || '');
            }
        }

        document.querySelectorAll('.ide-tab').forEach(tab => {
            tab.addEventListener('click', () => { SFX.click(); openFile(tab.dataset.file); });
        });
        openFile('sobre.js');

        function renderConsole(lines, error) {
            consoleEl.innerHTML = '';
            lines.slice(0, 500).forEach(l => {
                const line = document.createElement('div');
                line.className = 'ide-console-line';
                line.textContent = l;
                consoleEl.appendChild(line);
            });
            if (error) {
                const err = document.createElement('div');
                err.className = 'ide-console-line ide-console-error';
                err.textContent = '✖ ' + error;
                consoleEl.appendChild(err);
            }
            if (!lines.length && !error) {
                const hint = document.createElement('div');
                hint.className = 'ide-console-hint';
                hint.textContent = '// (sem saída — use console.log)';
                consoleEl.appendChild(hint);
            }
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }

        let currentRun = null;

        document.getElementById('ide-run').addEventListener('click', () => {
            SFX.click();
            // cancela o run anterior (worker, timeout e blob URL)
            if (currentRun) {
                clearTimeout(currentRun.killer);
                if (currentRun.worker) currentRun.worker.terminate();
                if (currentRun.url) URL.revokeObjectURL(currentRun.url);
                currentRun = null;
            }
            const code = playgroundEl.value;
            consoleEl.innerHTML = '<span class="ide-console-hint">▶ executando...</span>';
            let settled = false;
            const finish = (payload) => {
                if (settled) return;
                settled = true;
                const lines = Array.isArray(payload.logs) ? payload.logs : [];
                renderConsole(lines, payload.error);
            };

            let worker = null, blobUrl = null;
            try {
                // o código do usuário é embutido no fonte do blob worker (sem eval — a CSP permanece estrita)
                const src = 'const logs = [];\n' +
                    'const console = { log: (...a) => logs.push(a.map(String).join(" ")), warn: (...a) => logs.push("[warn] " + a.map(String).join(" ")), error: (...a) => logs.push("[error] " + a.map(String).join(" ")) };\n' +
                    'try {\n' + code + '\n self.postMessage({ ok: true, logs: logs });\n } catch (err) {\n self.postMessage({ ok: false, logs: logs, error: String(err) });\n }';
                blobUrl = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
                worker = new Worker(blobUrl);
            } catch (e) {
                renderConsole([], 'Sandbox indisponível neste navegador (sem suporte a Worker).');
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                return;
            }
            currentRun = { worker, url: blobUrl, killer: null };

            const killer = setTimeout(() => {
                worker.terminate();
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                currentRun = null;
                finish({ error: '⏱ Timeout de 2s — loop infinito detectado. O sandbox te salvou.' });
            }, 2000);
            currentRun.killer = killer;

            worker.onmessage = (e) => {
                clearTimeout(killer); worker.terminate();
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                currentRun = null;
                if (!e.data || typeof e.data.ok !== 'boolean') return; // postMessage alheio do código do usuário
                finish(e.data);
            };
            worker.onerror = (e) => {
                clearTimeout(killer); worker.terminate();
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                currentRun = null;
                finish({ error: 'Erro de sintaxe no playground: ' + (e.message || 'verifique o código') });
            };
        });
    }

    // --- 17. LUIZ BROWSER ---
    function initBrowserApp() {
        const viewport = document.getElementById('browser-viewport');
        const address = document.getElementById('browser-address');
        const loading = document.getElementById('browser-loading');
        if (!viewport) return;

        const history = [];
        let historyIndex = -1;

        function pageHome() {
            return '<div class="bp bp-home"><h1>LuizNet</h1><p class="bp-sub">sua página inicial dentro do LuizOS</p>' +
                '<div class="bp-grid">' +
                '<a class="bp-card" href="' + LINKS.github + '" target="_blank" rel="noopener noreferrer"><strong>GitHub</strong><span>github.com/LuiizFellipe</span></a>' +
                '<a class="bp-card" href="' + LINKS.linkedin + '" target="_blank" rel="noopener noreferrer"><strong>LinkedIn</strong><span>perfil profissional</span></a>' +
                '<button class="bp-card bl" data-go="luiiz://projetos" type="button"><strong>Projetos</strong><span>o que o Luiz andou construindo</span></button>' +
                '<button class="bp-card bl" data-go="luiiz://sobre" type="button"><strong>Sobre</strong><span>quem escreve esse código</span></button>' +
                '</div></div>';
        }

        function pageProjects() {
            const p = [
                ['VetPilot', 'IA, exames e simulados para veterinária', 'https://vetpilot.veteduka.com.br/'],
                ['W Check Brasil', 'Consulta veicular (+13k clientes)', 'https://app.wcheckbrasil.com.br'],
                ['Pupify', 'Prontuários veterinários por IA', 'https://app.pupify.com.br/'],
                ['CheckDomus', 'Vistorias com arquitetura moderna', 'https://app.checkdomus.com.br'],
                ['LuizOS', 'este site — o repo está no GitHub', 'https://github.com/LuiizFellipe/me']
            ];
            return '<div class="bp"><h1>Projetos</h1><ul class="bp-list">' +
                p.map(x => '<li><strong>' + x[0] + '</strong><span>' + x[1] + '</span><a href="' + x[2] + '" target="_blank" rel="noopener noreferrer">abrir ↗</a></li>').join('') +
                '</ul></div>';
        }

        function pageAbout() {
            return '<div class="bp"><h1>Sobre o Luiz</h1>' +
                '<p>AI Engineer e desenvolvedor apaixonado por resolver quebra-cabeças complexos — usando a ferramenta certa pra cada problema.</p>' +
                '<p><strong>Frontend:</strong> TypeScript, Next.js, Nuxt.js<br><strong>Backend:</strong> NestJS, Fastify, Supabase, N8n, RabbitMQ, Redis<br><strong>Infra:</strong> Docker, VPS</p>' +
                '<p class="bp-dim">Dica: tenta digitar <strong>sudo hire-luiz</strong> no terminal. 😉</p></div>';
        }

        function pageSandbox(url) {
            return '<div class="bp bp-center"><h1>🔒 Sandbox</h1>' +
                '<p>O Luiz Browser roda 100% dentro do portfólio e não carrega sites de verdade.</p>' +
                '<p class="bp-url">' + escapeHTML(url) + '</p>' +
                '<a class="bp-button" href="' + escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">Abrir fora do sandbox ↗</a>' +
                '<button class="bp-button secondary bl" data-go="luiiz://home" type="button">Voltar ao início</button></div>';
        }

        function page404(url) {
            return '<div class="bp bp-center"><h1>:(</h1><p><strong>' + escapeHTML(url) + '</strong> não existe na LuizNet.</p>' +
                '<p class="bp-dim">Código do erro: NEED_A_DEV_LIKE_LUIZ</p>' +
                '<button class="bp-button bl" data-go="luiiz://home" type="button">Voltar ao início</button></div>';
        }

        function render(url) {
            if (url === 'luiiz://home') return pageHome();
            if (url === 'luiiz://projetos') return pageProjects();
            if (url === 'luiiz://sobre') return pageAbout();
            if (/^https?:\/\//i.test(url)) return pageSandbox(url);
            if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(url)) return pageSandbox('https://' + url);
            return page404(url);
        }

        let renderTimer = null;
        function navigate(url, pushHistory = true) {
            url = (url || '').trim();
            if (!url) url = 'luiiz://home';
            if (pushHistory && history[historyIndex] !== url) {
                history.splice(historyIndex + 1);
                history.push(url);
                historyIndex = history.length - 1;
            }
            address.value = url;
            SFX.click();
            loading.classList.remove('active');
            void loading.offsetWidth; // reinicia a animação da barra
            loading.classList.add('active');
            if (renderTimer) clearTimeout(renderTimer); // navegação rápida não pisca páginas antigas
            renderTimer = setTimeout(() => {
                renderTimer = null;
                viewport.innerHTML = render(url);
                viewport.scrollTop = 0;
            }, 450);
        }

        viewport.addEventListener('click', (e) => {
            const link = e.target.closest('.bl');
            if (link) navigate(link.dataset.go);
        });
        document.getElementById('browser-go').addEventListener('click', () => navigate(address.value));
        address.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(address.value); });
        document.getElementById('browser-back').addEventListener('click', () => {
            if (historyIndex > 0) { historyIndex--; navigate(history[historyIndex], false); }
        });
        document.getElementById('browser-forward').addEventListener('click', () => {
            if (historyIndex < history.length - 1) { historyIndex++; navigate(history[historyIndex], false); }
        });

        navigate('luiiz://home');
    }

    // --- 18. WHATSAPP (Luiz Bot) ---
    const CHAT_TREE = {
        start: {
            msgs: ['Oi! 👋 Eu sou o Luiz Bot — a versão demo do Luiz.', 'Ele tá ocupado escrevendo código, então eu respondo por ele. Sobre o que a gente conversa?'],
            chips: [['Quem é o Luiz?', 'who'], ['Quero contratar! 💼', 'hire'], ['Ver projetos', 'projects']]
        },
        who: {
            msgs: ['Luiz Felipe Andrich — AI Engineer e dev fullstack.', 'Gosta de resolver quebra-cabeças complexos e de entregar produto que a pessoa realmente usa. Os detalhes estão na janela "Sobre Mim.txt".'],
            chips: [['Show! E os projetos?', 'projects'], ['Me convenceu, quero contratar', 'hire'], ['Voltar ao início', 'start']]
        },
        projects: {
            msgs: ['Destaques do portfólio: 🚀', '• VetPilot — IA pra veterinária\n• W Check — consulta veicular (+13k clientes)\n• Pupify — prontuários por IA\n• CheckDomus — vistorias online', 'Tem mais na janela Projetos ou digitando projects no terminal 😉'],
            chips: [['Quero contratar! 💼', 'hire'], ['Quem é o Luiz?', 'who']]
        },
        hire: {
            msgs: ['🎉 Excelente decisão!', 'Manda um oi pro Luiz de verdade — ele responde mais rápido do que eu:'],
            mail: true,
            chips: [['Voltar ao início', 'start']]
        }
    };

    function initChatApp() {
        const messagesEl = document.getElementById('chat-messages');
        const chipsEl = document.getElementById('chat-chips');
        if (!messagesEl) return { start() {}, cancel() {} };
        let started = false;
        let cancelled = false;

        function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

        function addMsg(text, fromUser) {
            const row = document.createElement('div');
            row.className = 'chat-msg ' + (fromUser ? 'chat-msg-user' : 'chat-msg-bot');
            const bubble = document.createElement('span');
            bubble.className = 'chat-bubble';
            bubble.textContent = text; // texto puro, nunca HTML
            row.appendChild(bubble);
            const time = document.createElement('span');
            time.className = 'chat-time';
            time.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + (fromUser ? ' ✓✓' : '');
            row.appendChild(time);
            messagesEl.appendChild(row);
            scrollBottom();
        }

        function showTyping() {
            const row = document.createElement('div');
            row.className = 'chat-msg chat-msg-bot chat-typing';
            row.innerHTML = '<span class="chat-bubble chat-bubble-typing"><i></i><i></i><i></i></span>';
            messagesEl.appendChild(row);
            scrollBottom();
            return row;
        }

        function showChips(nodeKey) {
            const node = CHAT_TREE[nodeKey];
            chipsEl.innerHTML = '';
            (node.chips || []).forEach(([label, go]) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'chat-chip';
                chip.textContent = label;
                chip.addEventListener('click', () => {
                    SFX.click();
                    addMsg(label, true);
                    chipsEl.innerHTML = '';
                    deliver(go);
                });
                chipsEl.appendChild(chip);
            });
            if (node.mail) {
                const a = document.createElement('a');
                a.className = 'chat-chip chat-chip-mail';
                a.href = 'mailto:' + LINKS.email;
                a.textContent = '✉ ' + LINKS.email;
                chipsEl.appendChild(a);
            }
        }

        async function deliver(nodeKey) {
            const node = CHAT_TREE[nodeKey];
            chipsEl.innerHTML = '';
            await sleep(350);
            for (const msg of node.msgs) {
                if (cancelled) return;
                const typingEl = showTyping();
                await sleep(Math.min(600 + msg.length * 8, 1400));
                if (cancelled) { typingEl.remove(); return; }
                typingEl.remove();
                addMsg(msg, false);
                await sleep(180);
            }
            if (cancelled) return;
            showChips(nodeKey);
            scrollBottom();
            if (nodeKey === 'hire') SFX.notify();
        }

        function start() {
            if (started) return;
            started = true;
            setTimeout(() => deliver('start'), 600);
        }

        function cancel() {
            cancelled = true;
            document.querySelectorAll('.chat-typing').forEach(t => t.remove());
        }

        return { start, cancel };
    }

    // --- 19. ÍCONES ARRASTÁVEIS ---
    function initIconDrag() {
        if (window.matchMedia('(pointer: coarse)').matches) return; // no touch os ícones ficam no grid
        const KEY = 'luizos-icon-pos';
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}

        document.querySelectorAll('.desktop-icon').forEach(icon => {
            const id = icon.dataset.window;
            if (saved[id] && typeof saved[id].x === 'number') {
                icon.classList.add('icon-absolute');
                // clamp: garante que o ícone não fique inalcançável após um resize
                const maxX = window.innerWidth - icon.offsetWidth;
                const maxY = window.innerHeight - document.getElementById('taskbar').offsetHeight - icon.offsetHeight;
                icon.style.left = Math.max(0, Math.min(saved[id].x, maxX)) + 'px';
                icon.style.top = Math.max(0, Math.min(saved[id].y, maxY)) + 'px';
            }

            icon.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                const startX = e.clientX, startY = e.clientY;
                const rect = icon.getBoundingClientRect();
                let dragging = false, offX = 0, offY = 0;

                const onMove = (ev) => {
                    if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
                    if (!dragging) {
                        dragging = true;
                        icon.classList.add('icon-absolute', 'dragging');
                        icon.style.left = rect.left + 'px';
                        icon.style.top = rect.top + 'px';
                        offX = ev.clientX - rect.left;
                        offY = ev.clientY - rect.top;
                    }
                    const maxX = window.innerWidth - icon.offsetWidth;
                    const maxY = window.innerHeight - document.getElementById('taskbar').offsetHeight - icon.offsetHeight;
                    icon.style.left = Math.max(0, Math.min(ev.clientX - offX, maxX)) + 'px';
                    icon.style.top = Math.max(0, Math.min(ev.clientY - offY, maxY)) + 'px';
                };

                const onUp = () => {
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    document.removeEventListener('pointercancel', onUp);
                    icon.classList.remove('dragging');
                    if (dragging) {
                        saved[id] = { x: parseInt(icon.style.left, 10) || 0, y: parseInt(icon.style.top, 10) || 0 };
                        try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* storage bloqueado */ }
                    }
                };
                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp);
                document.addEventListener('pointercancel', onUp);
                try { icon.setPointerCapture(e.pointerId); } catch (err) { /* pointer já solto */ }
            });
        });

        document.addEventListener('luizos:organize-icons', () => {
            try { localStorage.removeItem(KEY); } catch (e) {}
            document.querySelectorAll('.desktop-icon').forEach(icon => {
                icon.classList.remove('icon-absolute');
                icon.style.left = '';
                icon.style.top = '';
            });
        });
    }

    // --- 20. KONAMI CODE ---
    function initKonami() {
        const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
        let idx = 0;
        document.addEventListener('keydown', (e) => {
            const tag = document.activeElement ? document.activeElement.tagName : null;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            idx = (e.code === SEQ[idx]) ? idx + 1 : (e.code === SEQ[0] ? 1 : 0);
            if (idx === SEQ.length) {
                idx = 0;
                Achievements.unlock('konami');
                if (!MatrixRain.isActive()) MatrixRain.toggle();
                document.body.setAttribute('data-crt', 'on');
                try { saveSetting('crt', 'true'); } catch (err) { /* storage bloqueado */ }
                const crtToggle = document.getElementById('crt-toggle');
                if (crtToggle) crtToggle.checked = true;
            }
        });
    }

    // --- 21. EFEITO BSOD (TELA AZUL) ---
    function startInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(showBSOD, 120000); // 2 minutos
    }
    function resetInactivityTimer() { startInactivityTimer(); }
    function showBSOD() {
        bsodScreenEl.classList.remove('hidden');
        bsodScreenEl.classList.add('visible');
        MatrixRain.stop(); // garante que a chuva não fique por cima do BSOD
        document.addEventListener('keydown', handleBSODKeys);
        // Toque/clique em qualquer lugar também reinicia (essencial no mobile)
        bsodScreenEl.addEventListener('click', handleBSODClick);
    }
    function handleBSODKeys(e) {
        if (!bsodScreenEl.classList.contains('visible')) return;
        if (e.key === 'Enter') location.reload();
        else if (e.key.toLowerCase() === 'c') window.location.href = `mailto:${LINKS.email}`;
    }
    function handleBSODClick() {
        if (!bsodScreenEl.classList.contains('visible')) return;
        location.reload();
    }

    // --- INICIALIZAÇÃO ---
    applySavedSettings(); // Aplica configurações salvas ANTES do boot
    initBootSkip();
    runBootSequence();
});
