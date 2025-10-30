const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());

// Servir a página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Função para tentar adivinhar o caminho do perfil do navegador baseado em Flatpak ou não
function getCaminhoDoNavegador(browser) {
  const home = process.env.HOME;

  // Caminhos para navegadores instalados normalmente
  const caminhosNormais = {
    chrome: `${home}/.config/google-chrome`,
    brave: `${home}/.config/BraveSoftware/Brave-Browser`,
    firefox: `${home}/.mozilla/firefox`, // Firefox tem um sistema de perfis diferente
    edge: `${home}/.config/microsoft-edge`
  };

  // Caminhos para navegadores instalados via Flatpak
  const caminhosFlatpak = {
    chrome: `${home}/.var/app/com.google.Chrome/config/google-chrome`,
    brave: `${home}/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser`,
    firefox: `${home}/.var/app/org.mozilla.firefox/.mozilla/firefox`, // Exemplo
    edge: `${home}/.var/app/com.microsoft.Edge/config/microsoft-edge`
  };

  // Tenta encontrar o caminho correto
  // Primeiro, tenta o Flatpak
  if (fs.existsSync(caminhosFlatpak[browser])) {
    console.log(`Usando caminho Flatpak para ${browser}: ${caminhosFlatpak[browser]}`);
    return `${browser}:${caminhosFlatpak[browser]}`;
  }
  // Se não existir, tenta o caminho normal
  else if (fs.existsSync(caminhosNormais[browser])) {
    console.log(`Usando caminho normal para ${browser}: ${caminhosNormais[browser]}`);
    return `${browser}:${caminhosNormais[browser]}`;
  }
  else {
    // Se nenhum dos caminhos existir, retorna apenas o nome do navegador (padrão do yt-dlp)
    // Isso pode falhar, mas é a última tentativa.
    console.log(`Nenhum caminho conhecido encontrado para ${browser}, usando padrão.`);
    return browser; // Ex: 'chrome'
  }
}

// Rota para download
app.post('/download', (req, res) => {
  const { url, browser = 'brave' } = req.body; // Recebe o navegador detectado

  if (!url) {
    return res.status(400).send('URL não fornecida');
  }

  const cleanUrl = url.trim();
  console.log('Baixando:', cleanUrl, 'com navegador:', browser); // Log mais informativo

  // Escolher formato com base na plataforma
  let formatOption;
  if (cleanUrl.includes('pinterest.com') || cleanUrl.includes('pin.it')) {
    // Pinterest: vídeos SEM áudio ou imagem
    formatOption = 'best[ext=mp4]/best'; // Aceita vídeo ou imagem
  } else if (cleanUrl.includes('vimeo.com')) {
    // Vimeo: Pode não ter MP4 ou áudio separado, usar o melhor disponível
    formatOption = 'bv*+ba/b'; // Melhor vídeo + melhor áudio / ou melhor geral
  } else {
    // Outras plataformas (YouTube, Facebook, etc.): tentar vídeo + áudio
    formatOption = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
  }

  // Nome de arquivo mais seguro (ID + título limitado)
  const args = [
    cleanUrl,
    '--format', formatOption,
    '--trim-filenames', '100', // Limita o nome do arquivo a 100 caracteres
    '--merge-output-format', 'mp4',
    '--output', 'downloads/%(id)s_%(title,fulltitle,alt_title)s.%(ext)s' // Nome baseado no ID e título truncado
  ];

  // Adicionar cookies + impersonate para TikTok, Instagram e Vimeo (e outras que exigirem login)
  if (
    cleanUrl.includes('tiktok.com') ||
    cleanUrl.includes('instagram.com') ||
    cleanUrl.includes('vimeo.com')
    // Adicione outros domínios aqui conforme necessário
  ) {
    const navegadorComCaminho = getCaminhoDoNavegador(browser);
    args.push('--cookies-from-browser', navegadorComCaminho);
    args.push('--impersonate', 'chrome');
  }

  if (!fs.existsSync('downloads')) {
    fs.mkdirSync('downloads');
  }

  const ytDlp = spawn('yt-dlp', args);

  // --- TRATAMENTO DE ERROS DO YT-DLP (CORRIGIDO) ---
  ytDlp.on('error', (err) => {
    console.error(`Erro ao iniciar yt-dlp: ${err.message}`);
    // Se o spawn falhar (ex: yt-dlp não encontrado), retorne erro
    // Mas como isso ocorre após o fetch ser iniciado, é mais complexo.
    // Vamos apenas logar por enquanto, pois o erro real vem no 'close'.
    // O código abaixo no 'close' já lida com o código de saída != 0.
  });

  ytDlp.stdout.on('data', (data) => {
    console.log(`yt-dlp: ${data}`);
  });

  ytDlp.stderr.on('data', (data) => {
    console.error(`Erro: ${data}`);
  });

  ytDlp.on('close', (code) => {
    // Verifique se a resposta HTTP já foi enviada (previna enviar duas vezes)
    if (res.headersSent) {
        console.warn('Headers já enviados, não posso responder novamente.');
        return;
    }

    if (code === 0) {
      const files = fs.readdirSync('downloads');
      if (files.length === 0) {
        // O yt-dlp terminou com sucesso, mas nenhum arquivo foi salvo
        console.error('yt-dlp terminou com sucesso, mas nenhum arquivo foi encontrado na pasta downloads.');
        return res.status(500).json({ error: 'Nenhum arquivo foi salvo' });
      }

      // --- NOVO: Ordenar arquivos por data de modificação (do mais recente para o mais antigo) ---
      const filesWithPath = files.map(file => ({
        name: file,
        path: path.join(__dirname, 'downloads', file),
        mtime: fs.statSync(path.join(__dirname, 'downloads', file)).mtime.getTime()
      }));

      // Ordena do mais recente para o mais antigo
      filesWithPath.sort((a, b) => b.mtime - a.mtime);

      const lastFile = filesWithPath[0].name; // Pega o nome do mais recente
      // --- FIM NOVO ---

      res.json({ success: true, file: lastFile });
    } else {
      // O yt-dlp terminou com erro (code != 0)
      console.error(`yt-dlp terminou com código ${code}`);
      // Retorne erro para o frontend
      res.status(500).json({ error: 'Falha ao baixar o vídeo' });
    }
  });
  // --- FIM TRATAMENTO DE ERROS ---
});

// Servir arquivos baixados
app.get('/downloaded/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'downloads', filename);
  if (fs.existsSync(filepath)) {
    res.download(filepath);
  } else {
    res.status(404).send('Arquivo não encontrado');
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
