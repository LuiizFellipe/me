document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS GLOBAIS ---
    const bootContainerEl = document.getElementById('boot-container');
    const bootLogEl = document.getElementById('boot-log');
    const bootLoaderEl = document.getElementById('boot-loader');
    const bootStatusEl = document.getElementById('boot-status');

    const desktopEl = document.getElementById('desktop-environment');
    const classicWrapperEl = document.getElementById('classic-wrapper');
    const bsodScreenEl = document.getElementById('bsod-screen');
    const shutdownScreenEl = document.getElementById('shutdown-screen');

    let loaderWidth = 0;
    let highestZIndex = 100; // Para gerenciamento de janelas
    let inactivityTimer; // Para o BSOD

    // Helper 'sleep'
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- 1. GERENCIAMENTO DE CONFIGURAÇÕES (localStorage) ---
    function applySavedSettings() {
        const theme = localStorage.getItem('luizos-theme') || 'dark';
        const accent = localStorage.getItem('luizos-accent') || 'green';
        const wallpaper = localStorage.getItem('luizos-wallpaper') || 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1770&q=80';

        document.body.setAttribute('data-theme', theme);
        document.body.setAttribute('data-accent', accent);
        if (desktopEl) {
            desktopEl.style.backgroundImage = `url('${wallpaper}')`;
        }

        // Atualiza os seletores no app de Configurações
        const themeRadio = document.querySelector(`#theme-selector input[value="${theme}"]`);
        if (themeRadio) themeRadio.checked = true;

        document.querySelectorAll('.color-swatch').forEach(sw => {
            sw.classList.toggle('active', sw.dataset.accent === accent);
        });
        document.querySelectorAll('.wallpaper-thumb').forEach(thumb => {
            thumb.classList.toggle('active', thumb.dataset.url === wallpaper);
        });
    }

    function saveSetting(key, value) {
        localStorage.setItem(`luizos-${key}`, value);
    }

    // --- 2. DETECÇÃO DE DISPOSITIVO ---
    function isMobile() {
        return window.innerWidth < 768;
    }

    // --- 3. ANIMAÇÃO DE BOOT ---
    const bootLines = [
        "Iniciando LuizOS v1.0 (Kernel: JS/DOM)...",
        "Montando /dev/brain... [OK]",
        "Carregando módulos de criatividade... [OK]",
        "Verificando dispositivo... " + (isMobile() ? "<span class='warn'>[Dispositivo Móvel Detectado]</span>" : "<span class='success'>[Desktop Detectado]</span>"),
        "Iniciando modo: " + (isMobile() ? "Classic (Light)" : "Desktop Environment"),
        "Restaurando configurações salvas... [OK]",
        "Status: <span class='success'>Pronto.</span>"
    ];

    async function runBootSequence() {
        for (const line of bootLines) {
            bootLogEl.innerHTML += `${line}\n`;
            loaderWidth += (100 / bootLines.length);
            bootLoaderEl.style.width = `${loaderWidth}%`;
            bootContainerEl.scrollTop = bootContainerEl.scrollHeight;
            await sleep(100 + Math.random() * 50);
        }

        bootStatusEl.textContent = "[ BOOT CONCLUÍDO ]";
        await sleep(500); // Pausa
        startPortfolio();
    }

    function startPortfolio() {
        bootContainerEl.style.transition = 'opacity 0.5s ease-out';
        bootContainerEl.style.opacity = '0';

        setTimeout(() => {
            bootContainerEl.style.display = 'none';

            if (isMobile()) {
                classicWrapperEl.classList.remove('hidden');
                classicWrapperEl.classList.add('visible');
                document.body.style.overflow = 'auto'; // Permite scroll
            } else { // Desktop Mode
                desktopEl.classList.remove('hidden');
                desktopEl.classList.add('visible');
                initDesktop();
            }
        }, 500);
    }

    // --- 4. LÓGICA DO DESKTOP ENVIRONMENT ---
    function initDesktop() {
        initStartMenu();
        initWindowManager();
        initSettingsApp();
        initTerminal();
        initClock();
        startInactivityTimer();

        // Listeners para resetar o timer de inatividade
        ['click', 'mousemove', 'keydown', 'scroll'].forEach(event => {
            window.addEventListener(event, resetInactivityTimer);
        });
    }

    // --- 5. MENU INICIAR ---
    function initStartMenu() {
        const startButton = document.getElementById('start-button');
        const startMenu = document.getElementById('start-menu');

        startButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede que o clique feche o menu imediatamente
            startMenu.classList.toggle('hidden');
            startButton.classList.toggle('active');
        });

        // Fecha o menu se clicar fora
        window.addEventListener('click', (e) => {
            if (!startMenu.classList.contains('hidden') && !startMenu.contains(e.target) && !startButton.contains(e.target)) {
                startMenu.classList.add('hidden');
                startButton.classList.remove('active');
            }
        });

        // Ações do Menu
        startMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.start-menu-item');
            if (!item) return;

            const windowId = item.dataset.window;
            if (windowId) {
                openWindow(windowId);
            }

            // Fecha o menu após a ação
            startMenu.classList.add('hidden');
            startButton.classList.remove('active');
        });

        document.getElementById('restart-button').addEventListener('click', () => {
            location.reload();
        });

        document.getElementById('shutdown-button').addEventListener('click', () => {
            shutdownScreenEl.classList.remove('hidden');
            shutdownScreenEl.classList.add('visible');
            setTimeout(() => {
                // Simula o desligamento
                desktopEl.style.display = 'none';
                bsodScreenEl.style.display = 'none';
                document.body.style.backgroundColor = '#000';
            }, 1000);
            setTimeout(() => {
                window.close(); // Tenta fechar a aba
            }, 2500);
        });
    }

    // --- 6. GERENCIADOR DE JANELAS (O "WOW") ---
    function initWindowManager() {
        const icons = document.querySelectorAll('.desktop-icon');
        const windows = document.querySelectorAll('.window');
        const taskbarIconsEl = document.getElementById('taskbar-icons');

        icons.forEach(icon => {
            icon.addEventListener('dblclick', () => openWindow(icon.dataset.window));
        });
        document.querySelectorAll('.window-close').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                closeWindow(button.dataset.window);
            });
        });
        windows.forEach(windowEl => {
            windowEl.addEventListener('mousedown', () => focusWindow(windowEl));
        });
        makeWindowsDraggable();

        taskbarIconsEl.addEventListener('click', (e) => {
            const icon = e.target.closest('.taskbar-app-icon');
            if (!icon) return;
            const windowId = icon.dataset.window;
            const windowEl = document.getElementById(windowId);

            if (windowEl.classList.contains('hidden')) openWindow(windowId);
            else if (icon.classList.contains('active')) closeWindow(windowId);
            else focusWindow(windowEl);
        });
    }

    function openWindow(windowId) {
        const windowEl = document.getElementById(windowId);
        if (!windowEl) return;
        windowEl.classList.remove('hidden');
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
        if (windowId === 'terminal-window') document.getElementById('terminal-input').focus();
    }

    function closeWindow(windowId) {
        const windowEl = document.getElementById(windowId);
        if (windowEl) windowEl.classList.add('hidden');
        const taskbarIcon = document.querySelector(`.taskbar-app-icon[data-window="${windowId}"]`);
        if (taskbarIcon) taskbarIcon.classList.remove('active');
    }

    function focusWindow(windowEl) {
        highestZIndex++;
        windowEl.style.zIndex = highestZIndex;
        document.querySelectorAll('.taskbar-app-icon').forEach(icon => icon.classList.remove('active'));
        const taskbarIcon = document.querySelector(`.taskbar-app-icon[data-window="${windowEl.id}"]`);
        if (taskbarIcon) taskbarIcon.classList.add('active');
    }

    function getWindowIconData(windowId) {
        const desktopIcon = document.querySelector(`.desktop-icon[data-window="${windowId}"]`);
        return {
            src: desktopIcon.querySelector('img').src,
            alt: desktopIcon.querySelector('img').alt,
            title: desktopIcon.querySelector('span').textContent.replace('.txt', '')
        };
    }

    function makeWindowsDraggable() {
        let activeWindow = null, offset = { x: 0, y: 0 };
        document.querySelectorAll('.window-header').forEach(header => {
            header.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('window-close')) return;
                activeWindow = header.closest('.window');
                focusWindow(activeWindow);
                offset = { x: e.clientX - activeWindow.getBoundingClientRect().left, y: e.clientY - activeWindow.getBoundingClientRect().top };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
        function onMouseMove(e) {
            if (!activeWindow) return;
            let newX = e.clientX - offset.x, newY = e.clientY - offset.y;
            const taskbarHeight = document.getElementById('taskbar').offsetHeight;
            newY = Math.max(0, Math.min(newY, window.innerHeight - taskbarHeight - 20));
            newX = Math.max(0, Math.min(newX, window.innerWidth - activeWindow.offsetWidth));
            activeWindow.style.left = `${newX}px`; activeWindow.style.top = `${newY}px`;
        }
        function onMouseUp() {
            activeWindow = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    }

    // --- 7. APP DE CONFIGURAÇÕES (NOVO) ---
    function initSettingsApp() {
        const themeSelector = document.getElementById('theme-selector');
        const accentSelector = document.getElementById('accent-selector');
        const wallpaperSelector = document.getElementById('wallpaper-selector');

        // Mudar Tema
        themeSelector.addEventListener('change', (e) => {
            const theme = e.target.value;
            document.body.setAttribute('data-theme', theme);
            saveSetting('theme', theme);
        });

        // Mudar Cor de Destaque
        accentSelector.addEventListener('click', (e) => {
            const swatch = e.target.closest('.color-swatch');
            if (!swatch) return;
            const accent = swatch.dataset.accent;
            document.body.setAttribute('data-accent', accent);
            saveSetting('accent', accent);
            // Atualiza classe 'active'
            accentSelector.querySelector('.active')?.classList.remove('active');
            swatch.classList.add('active');
        });

        // Mudar Papel de Parede
        wallpaperSelector.addEventListener('click', (e) => {
            const thumb = e.target.closest('.wallpaper-thumb');
            if (!thumb) return;
            const url = thumb.dataset.url;
            desktopEl.style.backgroundImage = `url('${url}')`;
            saveSetting('wallpaper', url);
            // Atualiza classe 'active'
            wallpaperSelector.querySelector('.active')?.classList.remove('active');
            thumb.classList.add('active');
        });
    }

    // --- 8. LÓGICA DO RELÓGIO ---
    function initClock() {
        const clockEl = document.getElementById('clock');
        function updateClock() {
            const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            clockEl.textContent = time;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    // --- 9. LÓGICA DO TERMINAL (Completa) ---
    function initTerminal() {
        const terminalOutputEl = document.getElementById('terminal-output');
        const terminalInputEl = document.getElementById('terminal-input');
        const terminalBodyEl = document.getElementById('terminal-body');

        if (!terminalBodyEl) return;

        const projects = {
            "vetpilot": { title: "VetPilot", description: "Sistema de chat com IA, exames, aulas e simulados...", tech: "[ Next.js, Supabase, Postgres, AI ]", link: "https://github.com/LuiizFellipe/projeto-a" },
            "wcheck": { title: "W Check Brasil", description: "Maior plataforma de consulta veicular e análise de crédito...", tech: "[ Next.js, Postgres, AWS ]", link: "https://github.com/LuiizFellipe/projeto-b" },
            "portfolio-os": { title: "Este Portfólio (Meta!)", description: "O próprio portfólio que você está usando.", tech: "[ Vanilla JavaScript, HTML5, CSS ]", link: "https://github.com/LuiizFellipe/meu-portfolio" }
        };
        const files = {
            'about.txt': `Olá! Sou o Luiz Felipe Andrich. 
Um desenvolvedor focado em lógica, performance e em entregar algo que os usuários *realmente* queiram usar.`,
            'contact.sh': `#!/bin/bash
echo "LinkedIn: httpsA://www.linkedin.com/in/SEU_LINKEDIN"
echo "GitHub:   https://github.com/LuiizFellipe"
echo "Email:    mailto:andrich.luiz@gmail.com"`
        };
        const commands = {
            'help': "Comandos: <span class='highlight'>neofetch</span>, <span class='highlight'>skills</span>, <span class='highlight'>projects</span>, <span class='highlight'>ls</span>, <span class='highlight'>cat [arquivo]</span>, <span class='highlight'>contact</span>, <span class='highlight'>whoami</span>, <span class='highlight'>date</span>, <span class='highlight'>sudo</span>, <span class='highlight'>clear</span>",
            'neofetch': `<span class="neofetch-ascii">    )      (
   (   (     )
  (    )    )
 (____(__)____) ... </span>
<div class="neofetch-info"><span class="info-label">Usuário</span><span class="info-value">luiz_felipe_andrich</span></div>
<div class="neofetch-info"><span class="info-label">OS</span><span class="info-value">LuizOS v1.0</span></div>
<div class="neofetch-info"><span class="info-label">Foco</span><span class="info-value">Fullstack, Arquitetura</span></div>`,
            'skills': `<span class="highlight">//--- FRONTEND ---//</span>
  ▹ JavaScript, TypeScript, React, Next.js
<span class="highlight">//--- BACKEND ---//</span>
  ▹ Node.js, Python, PostgreSQL, Redis
<span class="highlight">//--- CONCEITOS ---//</span>
  ▹ Arquitetura, Filas (RabbitMQ), Git, Docker`,
            'projects': `Projetos: <span class="project-title">vetpilot</span>, <span class="project-title">wcheck</span>, <span class="project-title">portfolio-os</span>.
Digite <span class='highlight'>projects [nome]</span> para detalhes.`,
            'ls': `<span class="ls-dir">projects/</span>  <span class="ls-file">about.txt</span>  <span class="ls-exec">contact.sh</span>`,
            'contact': `LinkedIn: <a href="httpsA://www.linkedin.com/in/SEU_LINKEDIN" target="_blank">.../SEU_LINKEDIN</a>
GitHub:   <a href="https://github.com/LuiizFellipe" target="_blank">.../SEU_GITHUB</a>
Email:    <a href="mailto:andrich.luiz@gmail.com">andrich.luiz@gmail.com</a>`,
            'whoami': 'luiz_felipe_andrich (O dev que você estava procurando)',
            'date': `Hoje é ${new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}... Hora de me contratar.`,
            'clear': '',
            'sudo': '<span class="error">Acesso negado.</span> Mas legal você ter tentado. 😉',
            'sudo rm -rf /': '<span class="warn">Quase!</span> Sistema protegido.'
        };

        terminalBodyEl.addEventListener('click', () => terminalInputEl.focus());
        terminalInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const command = terminalInputEl.value.trim().toLowerCase();
                if (command) {
                    logToTerminal(command, 'command');
                    terminalInputEl.value = '';
                    processCommand(command);
                }
            }
        });

        function processCommand(command) {
            if (command === 'clear') { terminalOutputEl.innerHTML = ''; return; }
            let response = '';
            if (command.startsWith('projects ')) {
                const pName = command.split(' ')[1];
                const p = projects[pName];
                response = p ? `Carregando <span class="project-title">${p.title}</span>...
  <span class="highlight">Descrição:</span> ${p.description}
  <span class="highlight">Stack:</span>     ${p.tech}
  <span class="highlight">Link:</span> <a href="${p.link}" target="_blank">${p.link}</a>`
                    : `<span class="error">Projeto '${pName}' não encontrado.</span>`;
            } else if (command.startsWith('cat ')) {
                const fName = command.split(' ')[1];
                response = files[fName] ? files[fName] : `<span class="error">cat:</span> '${fName}': Arquivo não encontrado.`;
            } else {
                response = commands[command] || `<span class="error">Comando não encontrado:</span> <span class="highlight">${command}</span>. Digite 'help'.`;
            }
            logToTerminal(response, 'response');
        }

        async function logToTerminal(text, typeClass) {
            const lineEl = document.createElement('div');
            lineEl.className = `terminal-output-line ${typeClass}`;
            if (typeClass === 'command') {
                lineEl.innerHTML = `<span class="prompt-prefix">luiz@portfolio:~$</span> ${text}`;
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
                    terminalBodyEl.scrollTop = terminalBodyEl.scrollHeight;
                    if (i < text.length) await sleep(5); // Mais rápido
                }
            }
            terminalBodyEl.scrollTop = terminalBodyEl.scrollHeight;
        }
        logToTerminal(`Bem-vindo ao <span class="highlight">LuizOS v1.0</span>. Digite 'help'.`, 'response');
    }

    // --- 10. EFEITO BSOD (TELA AZUL) ---
    function startInactivityTimer() {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(showBSOD, 60000); // 1 minuto
    }
    function resetInactivityTimer() { startInactivityTimer(); }
    function showBSOD() {
        if (!isMobile()) {
            bsodScreenEl.classList.remove('hidden');
            bsodScreenEl.classList.add('visible');
            document.addEventListener('keydown', handleBSODKeys);
        }
    }
    function handleBSODKeys(e) {
        if (bsodScreenEl.classList.contains('hidden')) return;
        if (e.key === 'Enter') location.reload();
        else if (e.key.toLowerCase() === 'c') window.location.href = 'mailto:andrich.luiz@gmail.com';
    }

    // --- INICIALIZAÇÃO ---
    applySavedSettings(); // Aplica configurações salvas ANTES do boot
    runBootSequence();
});