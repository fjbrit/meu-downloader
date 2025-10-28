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
  const { url, browser = 'brave' } = req.body;

  if (!url) {
    return res.status(400).send('URL não fornecida');
  }

  // 🔥 Remover espaços da URL
  const cleanUrl = url.trim();
  console.log('Baixando:', cleanUrl);

  // 🔥 Escolher formato com base na plataforma
  let formatOption;
  if (cleanUrl.includes('pinterest.com') || cleanUrl.includes('pin.it')) {
    formatOption = 'bestvideo[ext=mp4]/best[ext=mp4]/best'; // Pinterest: só vídeo
  } else {
    formatOption = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
  }

  const args = [
    cleanUrl,
    '--format', formatOption,
    '--merge-output-format', 'mp4',
    '--output', 'downloads/%(title)s.%(ext)s'
  ];

  // Só adicionar cookies para TikTok/Instagram
  if (cleanUrl.includes('tiktok.com') || cleanUrl.includes('instagram.com')) {
    args.push('--cookies-from-browser', browser);
    args.push('--impersonate', 'chrome');
  }

  // Criar pasta de downloads se não existir
  if (!fs.existsSync('downloads')) {
    fs.mkdirSync('downloads');
  }

  const ytDlp = spawn('yt-dlp', args);

  ytDlp.stdout.on('data', (data) => {
    console.log(`yt-dlp: ${data}`);
  });

  ytDlp.stderr.on('data', (data) => {
    console.error(`Erro: ${data}`);
  });

  ytDlp.on('close', (code) => {
    if (code === 0) {
      const files = fs.readdirSync('downloads');
      if (files.length === 0) {
        return res.status(500).json({ error: 'Nenhum arquivo foi salvo' });
      }
      const lastFile = files[files.length - 1];
      res.json({ success: true, file: lastFile });
    } else {
      res.status(500).json({ error: 'Falha ao baixar o vídeo' });
    }
  });
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