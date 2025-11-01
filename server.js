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

// Função aprimorada para detectar caminho do navegador
function getCaminhoDoNavegador(browser) {
  const home = process.env.HOME;

  const caminhos = {
    flatpak: {
      chrome: `${home}/.var/app/com.google.Chrome/config/google-chrome`,
      brave: `${home}/.var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser`,
      firefox: `${home}/.var/app/org.mozilla.firefox/.mozilla/firefox`,
      edge: `${home}/.var/app/com.microsoft.Edge/config/microsoft-edge`,
      chromium: `${home}/.var/app/org.chromium.Chromium/config/chromium`
    },
    normal: {
      chrome: `${home}/.config/google-chrome`,
      brave: `${home}/.config/BraveSoftware/Brave-Browser`,
      firefox: `${home}/.mozilla/firefox`,
      edge: `${home}/.config/microsoft-edge`,
      chromium: `${home}/.config/chromium`
    }
  };

  if (fs.existsSync(caminhos.flatpak[browser])) {
    console.log(`✅ Usando caminho Flatpak para ${browser}: ${caminhos.flatpak[browser]}`);
    return `${browser}:${caminhos.flatpak[browser]}`;
  }
  
  if (fs.existsSync(caminhos.normal[browser])) {
    console.log(`✅ Usando caminho normal para ${browser}: ${caminhos.normal[browser]}`);
    return `${browser}:${caminhos.normal[browser]}`;
  }

  console.log(`⚠️ Caminho não encontrado para ${browser}, usando padrão`);
  return browser;
}

// Detectar plataforma e retornar configurações específicas
function getPlataformaConfig(url) {
  const urlLower = url.toLowerCase();
  
  const configs = {
      tiktok: {
      match: ['tiktok.com'],
      needsCookies: true,
      needsImpersonate: true,
      format: 'best[ext=mp4]/best',
      extraArgs: [
        // '--user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', // Removido
        '--referer', 'https://www.tiktok.com/', // Espaço extra removido ✅
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:pt-BR,pt;q=0.9,en;q=0.7'
      ],
      retries: 3
    },
    instagram: {
      match: ['instagram.com', 'instagr.am'],
      needsCookies: true,
      needsImpersonate: true,
      format: 'best[ext=mp4]/best',
      audioFormat: 'bestaudio[ext=m4a]/bestaudio',
      extraArgs: [
        '--user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        '--referer', 'https://www.instagram.com/'
      ],
      retries: 2
    },
    pinterest: {
      match: ['pinterest.com', 'pin.it'],
      needsCookies: false,
      needsImpersonate: false,
      format: 'best[ext=mp4]/best',
      audioFormat: 'bestaudio',
      extraArgs: [],
      retries: 2
    },
    vimeo: {
      match: ['vimeo.com'],
      needsCookies: true,
      needsImpersonate: false,
      format: 'bv*+ba/b',
      audioFormat: 'bestaudio',
      extraArgs: [],
      retries: 2
    },
    youtube: {
      match: ['youtube.com', 'youtu.be'],
      needsCookies: false,
      needsImpersonate: false,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      audioFormat: 'bestaudio[ext=m4a]/bestaudio',
      extraArgs: [],
      retries: 2
    },
    facebook: {
      match: ['facebook.com', 'fb.watch'],
      needsCookies: true,
      needsImpersonate: true,
      format: 'best[ext=mp4]/best',
      audioFormat: 'bestaudio',
      extraArgs: [],
      retries: 2
    },
    twitter: {
      match: ['twitter.com', 'x.com'],
      needsCookies: false,
      needsImpersonate: false,
      format: 'best[ext=mp4]/best',
      audioFormat: 'bestaudio',
      extraArgs: [],
      retries: 2
    }
  };

  for (const [plataforma, config] of Object.entries(configs)) {
    if (config.match.some(domain => urlLower.includes(domain))) {
      return { plataforma, ...config };
    }
  }

  return {
    plataforma: 'genérica',
    needsCookies: false,
    needsImpersonate: false,
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    audioFormat: 'bestaudio[ext=m4a]/bestaudio',
    extraArgs: [],
    retries: 1
  };
}

// FUNÇÃO CORRIGIDA: Tentar download com múltiplas estratégias
async function tentarDownload(url, browser, mediaType = 'video_audio', tentativa = 1, maxTentativas = 3) {
  return new Promise((resolve, reject) => {
    const config = getPlataformaConfig(url);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 Tentativa ${tentativa}/${maxTentativas} - Plataforma: ${config.plataforma}`);
    console.log(`🔗 URL: ${url}`);
    console.log(`🎵 Tipo: ${mediaType}`);
    console.log(`${'='.repeat(60)}`);

    // Configurar formato baseado no tipo de mídia
    let formatOption = config.format;
    let mergeOutputFormat = 'mp4';
    let postProcessArgs = [];

    if (mediaType === 'audio_mp3') {
      formatOption = config.audioFormat;
      postProcessArgs = ['--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0'];
      console.log('🎵 Modo: Extrair apenas áudio (MP3)');
    } else if (mediaType === 'audio_m4a') {
      formatOption = config.audioFormat;
      postProcessArgs = ['--extract-audio', '--audio-format', 'm4a'];
      console.log('🎵 Modo: Extrair apenas áudio (M4A)');
    } else if (mediaType === 'video_only') {
      formatOption = 'bestvideo[ext=mp4]/bestvideo';
      mergeOutputFormat = 'mp4';
      console.log('🎬 Modo: Apenas vídeo (sem áudio)');
    }

    // Argumentos base
    const args = [
      url,
      '--format', formatOption,
      '--trim-filenames', '100',
      '--output', 'downloads/%(id)s_%(title).50B.%(ext)s',
      '--no-check-certificate'
    ];

    // Adicionar merge-output-format apenas se não for extração de áudio
    if (postProcessArgs.length === 0) {
      args.push('--merge-output-format', mergeOutputFormat);
    }

    // Adicionar pós-processamento
    args.push(...postProcessArgs);

    // Adicionar cookies se necessário
    if (config.needsCookies) {
      const navegadorComCaminho = getCaminhoDoNavegador(browser);
      args.push('--cookies-from-browser', navegadorComCaminho);
    }

    // Adicionar impersonate
    if (config.needsImpersonate) {
      args.push('--impersonate', 'chrome');
    }

    // Adicionar argumentos extras
    args.push(...config.extraArgs);

    // Estratégias progressivas para TikTok
    if (config.plataforma === 'tiktok') {
      if (tentativa === 2) {
        // Segunda tentativa: adicionar extractor args
        args.push('--extractor-args', 'tiktok:api_hostname=api16-normal-c-useast2a.tiktokv.com');
        console.log('🔧 Usando hostname alternativo do TikTok (api16)');
      } else if (tentativa === 3) {
        // Terceira tentativa: forçar embed
        args.push('--extractor-args', 'tiktok:api_hostname=api16-normal-c-useast2a.tiktokv.com;tiktok:webpage_download=False');
        console.log('🔧 Tentando método embed do TikTok com hostname api16');
      }
    }

    // Criar pasta downloads se não existir
    if (!fs.existsSync('downloads')) {
      fs.mkdirSync('downloads');
    }

    console.log('🚀 Executando yt-dlp...');

    const ytDlp = spawn('yt-dlp', args);
    let errorOutput = '';
    let stdoutOutput = '';

    ytDlp.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutOutput += output;
      console.log(`yt-dlp: ${output.trim()}`);
    });

    ytDlp.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      // Mostrar apenas erros relevantes (não debug)
      if (!output.includes('[debug]') && output.trim().length > 0) {
        console.error(`yt-dlp erro: ${output.trim()}`);
      }
    });

    ytDlp.on('error', (err) => {
      console.error(`❌ Erro ao iniciar yt-dlp: ${err.message}`);
      reject({ 
        error: 'Erro ao iniciar yt-dlp', 
        details: err.message,
        needsInstall: true
      });
    });

    ytDlp.on('close', (code) => {
      if (code === 0) {
        console.log('✅ yt-dlp terminou com sucesso!');
        
        // Buscar arquivo mais recente
        try {
          const files = fs.readdirSync('downloads');
          if (files.length === 0) {
            console.error('⚠️ Nenhum arquivo encontrado');
            reject({ error: 'Nenhum arquivo foi salvo' });
            return;
          }

          // Ordenar por data de modificação (mais recente primeiro)
          const filesWithStats = files.map(file => {
            const filepath = path.join(__dirname, 'downloads', file);
            return {
              name: file,
              mtime: fs.statSync(filepath).mtime.getTime()
            };
          });

          filesWithStats.sort((a, b) => b.mtime - a.mtime);
          const lastFile = filesWithStats[0].name;
          
          console.log(`📁 Arquivo salvo: ${lastFile}`);
          resolve({ success: true, file: lastFile, tentativas: tentativa });
          
        } catch (err) {
          console.error('❌ Erro ao ler pasta downloads:', err);
          reject({ error: 'Erro ao acessar arquivo baixado' });
        }
        
      } else {
        console.error(`❌ yt-dlp terminou com código ${code}`);
        
        // Verificar se deve fazer retry
        const deveRetry = errorOutput.includes('requiring login') || 
                         errorOutput.includes('Sign in to confirm') ||
                         errorOutput.includes('HTTP Error 403') ||
                         errorOutput.includes('Unable to extract');

        if (deveRetry && tentativa < maxTentativas) {
          console.log(`🔄 Tentando novamente... (${tentativa + 1}/${maxTentativas})`);
          
          // Aguardar 2 segundos antes de retry
          setTimeout(() => {
            tentarDownload(url, browser, mediaType, tentativa + 1, maxTentativas)
              .then(resolve)
              .catch(reject);
          }, 2000);
          
        } else {
          // Falha definitiva
          reject({ 
            error: 'Falha ao baixar o vídeo', 
            code,
            details: errorOutput,
            stdout: stdoutOutput
          });
        }
      }
    });
  });
}

// ROTA CORRIGIDA: Download
app.post('/download', async (req, res) => {
  const { url, browser = 'brave', mediaType = 'video_audio' } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL não fornecida' });
  }

  const cleanUrl = url.trim();
  const config = getPlataformaConfig(cleanUrl);

  console.log(`\n${'🎬'.repeat(30)}`);
  console.log(`🆕 Nova requisição de download`);
  console.log(`📱 Plataforma: ${config.plataforma}`);
  console.log(`🌐 Navegador: ${browser}`);
  console.log(`🎵 Tipo de Mídia: ${mediaType}`);
  console.log(`${'🎬'.repeat(30)}\n`);

  try {
    const resultado = await tentarDownload(cleanUrl, browser, mediaType, 1, config.retries);
    res.json(resultado);
    
  } catch (error) {
    console.error('❌ Erro final:', error);
    
    const errorResponse = {
      error: error.error || 'Erro desconhecido',
      plataforma: config.plataforma,
      sugestoes: []
    };

    // Sugestões específicas
    if (error.needsInstall) {
      errorResponse.sugestoes.push(
        '⚠️ yt-dlp não está instalado ou não está no PATH',
        'Instale com: pip install yt-dlp',
        'Ou: sudo apt install yt-dlp (Ubuntu/Debian)',
        'Reinicie o servidor após a instalação'
      );
    } else if (error.details && error.details.includes('requiring login')) {
      errorResponse.sugestoes.push(
        `Faça login no ${config.plataforma} no navegador ${browser}`,
        'Certifique-se de que o navegador está FECHADO',
        'Navegue por alguns vídeos antes de exportar cookies',
        'Limpe cookies e faça login novamente'
      );
    } else if (error.details && error.details.includes('HTTP Error 403')) {
      errorResponse.sugestoes.push(
        'O conteúdo pode estar restrito geograficamente',
        'Tente usar uma VPN',
        'Verifique se o vídeo é público'
      );
    } else if (error.details && error.details.includes('Video unavailable')) {
      errorResponse.sugestoes.push(
        'O vídeo pode ter sido removido',
        'Verifique se o link está correto',
        'O vídeo pode ser privado'
      );
    }

    res.status(500).json(errorResponse);
  }
});

// Servir arquivos baixados
app.get('/downloaded/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'downloads', filename);
  
  if (fs.existsSync(filepath)) {
    res.download(filepath, (err) => {
      if (err) {
        console.error('Erro ao enviar arquivo:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Erro ao enviar arquivo' });
        }
      }
    });
  } else {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// Limpar arquivos antigos
app.post('/cleanup', (req, res) => {
  try {
    if (!fs.existsSync('downloads')) {
      return res.json({ success: true, removidos: 0 });
    }

    const files = fs.readdirSync('downloads');
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    
    let removidos = 0;
    files.forEach(file => {
      const filepath = path.join(__dirname, 'downloads', file);
      const stats = fs.statSync(filepath);
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filepath);
        removidos++;
      }
    });
    
    res.json({ success: true, removidos });
  } catch (error) {
    console.error('Erro ao limpar arquivos:', error);
    res.status(500).json({ error: 'Erro ao limpar arquivos' });
  }
});

// Status do sistema
app.get('/status', (req, res) => {
  const status = {
    online: true,
    downloads_folder: fs.existsSync('downloads'),
    files_count: fs.existsSync('downloads') ? fs.readdirSync('downloads').length : 0,
    navegadores_disponiveis: []
  };

  ['brave', 'chrome', 'chromium', 'firefox', 'edge'].forEach(browser => {
    const caminho = getCaminhoDoNavegador(browser);
    if (caminho.includes(':')) {
      status.navegadores_disponiveis.push(browser);
    }
  });

  res.json(status);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n${'✅'.repeat(30)}`);
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📁 Pasta de downloads: ${path.join(__dirname, 'downloads')}`);
  console.log(`${'✅'.repeat(30)}\n`);
});