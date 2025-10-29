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
    formatOption = 'bestvideo[ext=mp4]/best[ext=mp4]/best';
  } else {
    formatOption = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
  }

  // --- NOVO: Nome de arquivo mais seguro (ID + título limitado) ---
  const args = [
    cleanUrl,
    '--format', formatOption,
    '--trim-filenames', '100', // Limita o nome do arquivo a 100 caracteres
    '--merge-output-format', 'mp4',
    '--output', 'downloads/%(id)s_%(title,fulltitle,alt_title)s.%(ext)s' // Nome baseado no ID e título truncado
  ];

  // Adicionar cookies + impersonate para TikTok e Instagram
  if (cleanUrl.includes('tiktok.com') || cleanUrl.includes('instagram.com')) {
    args.push('--cookies-from-browser', browser);
    args.push('--impersonate', 'chrome'); // Impersonate funciona bem para todos os Chromium-based e Firefox nesse contexto
  }

  if (!fs.existsSync('downloads')) {
    fs.mkdirSync('downloads');
  }

  const ytDlp = spawn('yt-dlp', args);

  // --- TRATAMENTO DE ERROS DO YT-DLP (CORRIGIDO) ---
  ytDlp.on('error', (err) => {
    console.error(`Erro ao iniciar yt-dlp: ${err.message}`);
    // Se o spawn falhar (ex: yt-dlp não encontrado), retorne erro
    if (!res.headersSent) {
      res.status(500).json({ error: 'Falha ao iniciar o yt-dlp' });
    }
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
      const lastFile = files[files.length - 1];
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