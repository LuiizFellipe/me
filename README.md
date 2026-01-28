# LuizOS Portfolio 🖥️

Um portfólio interativo inspirado em sistemas operacionais, simulando um ambiente desktop completo rodando diretamente no navegador.

![LuizOS Preview](https://via.placeholder.com/800x450?text=Preview+do+Portfolio) 
*(Substitua este link por um screenshot real do seu projeto)*

## 🚀 Sobre o Projeto

Este projeto foge do padrão de portfólios estáticos tradicionais. Ele foi construído para demonstrar habilidades em lógica de programação e manipulação do DOM, criando uma experiência imersiva para o usuário.

O "sistema operacional" **LuizOS** conta com:
- **Boot Sequence**: Uma animação inicial de carregamento de sistema.
- **Window Manager**: Sistema de janelas arrastáveis, com foco (z-index), minimizar e fechar.
- **Terminal Interativo**: Um shell funcional com comandos como `help`, `cat`, `projects` e easter eggs.
- **Configurações em Tempo Real**: Personalização de temas, cores de destaque e papel de parede, persistidos via `localStorage`.
- **BSOD (Blue Screen of Death)**: Uma tela de erro divertida que aparece após inatividade (desktop).

## 🛠️ Tecnologias Utilizadas

O projeto foi desenvolvido utilizando **apenas tecnologias nativas**, sem o uso de frameworks pesados, para garantir performance máxima e demonstrar domínio da base da web:

- **HTML5**: Estrutura semântica.
- **CSS3**: Estilização, animações, variáveis CSS (para temas) e Layout Flexbox/Grid.
- **JavaScript (ES6+)**: Toda a lógica do SO, gerenciamento de janelas, terminal e estado global.

## ✨ Funcionalidades

### 🖥️ Desktop Environment
Uma interface gráfica completa com ícones, barra de tarefas e relógio em tempo real.

### ⌨️ Terminal Simulator
Um terminal onde você pode navegar pelos projetos e informações via linha de comando.
**Comandos disponíveis:**
- `help`: Lista todos os comandos.
- `projects`: Lista os projetos do portfólio.
- `skills`: Mostra as habilidades técnicas.
- `contact`: Exibe informações de contato.
- `neofetch`: Exibe informações do sistema com arte ASCII.
- `whoami`, `date`, `clear`.
- `sudo`: Tente e veja o que acontece! 😉

### ⚙️ Personalização (Settings App)
O usuário pode personalizar a experiência:
- **Temas**: Dark (Padrão), Light, Matrix.
- **Cores**: Verde, Azul, Rosa, Laranja.
- **Wallpaper**: Seleção de fundos dinâmicos.

## 📱 Mobile Support
O sistema detecta automaticamente dispositivos móveis e carrega uma versão "Classic" (Layout de rolagem tradicional) para garantir a melhor usabilidade em telas pequenas, já que um gerenciador de janelas não seria prático no mobile.

## 📦 Como Rodar

1. Clone o repositório:
   ```bash
   git clone https://github.com/LuiizFellipe/me.git
   ```
2. Abra o arquivo `index.html` em qualquer navegador moderno.

---

Feito com 💜 e muito Café por Mim.
