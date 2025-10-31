// Versão 1.0 - Adicionando suporte a múltiplas plataformas

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

  // Prioriza Flatpak
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

// Nova função: Detectar plataforma e retornar configurações específicas
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
        '--referer', 'https://www.tiktok.com/', // ✅ Espaço extra removido
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
      extraArgs: [],
      retries: 2
    },
    vimeo: {
      match: ['vimeo.com'],
      needsCookies: true,
      needsImpersonate: false,
      format: 'bv*+ba/b', // Formato mais flexível para Vimeo
      extraArgs: [],
      retries: 2
    },
    youtube: {
      match: ['youtube.com', 'youtu.be'],
      needsCookies: false,
      needsImpersonate: false,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      extraArgs: [],
      retries: 2
    },
    facebook: {
      match: ['facebook.com', 'fb.watch'],
      needsCookies: true,
      needsImpersonate: true,
      format: 'best[ext=mp4]/best',
      extraArgs: [],
      retries: 2
    },
    twitter: {
      match: ['twitter.com', 'x.com'],
      needsCookies: false,
      needsImpersonate: false,
      format: 'best[ext=mp4]/best',
      extraArgs: [],
      retries: 2
    }
  };

  // Detecta a plataforma
  for (const [plataforma, config] of Object.entries(configs)) {
    if (config.match.some(domain => urlLower.includes(domain))) {
      return { plataforma, ...config };
    }
  }

  // Configuração padrão
  return {
    plataforma: 'genérica',
    needsCookies: false,
    needsImpersonate: false,
    format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    extraArgs: [],
    retries: 1
  };
}

// Função para tentar download com múltiplas estratégias
async function tentarDownload(url, browser, tentativa = 1, maxTentativas = 3) {
  return new Promise((resolve, reject) => {
    const config = getPlataformaConfig(url);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📥 Tentativa ${tentativa}/${maxTentativas} - Plataforma: ${config.plataforma}`);
    console.log(`🔗 URL: ${url}`);
    console.log(`${'='.repeat(60)}`);

    // Argumentos base
    const args = [
      url,
      '--format', config.format,
      '--trim-filenames', '100',
      '--merge-output-format', 'mp4',
      '--output', 'downloads/%(id)s_%(title).100B.%(ext)s',
      '--no-check-certificate',
      '--verbose' // Mais detalhes nos logs
    ];

    // Adicionar cookies e impersonate se necessário
    if (config.needsCookies) {
      const navegadorComCaminho = getCaminhoDoNavegador(browser);
      args.push('--cookies-from-browser', navegadorComCaminho);
    }

    if (config.needsImpersonate) {
      args.push('--impersonate', 'chrome');
    }

    // Adicionar argumentos extras da plataforma
    args.push(...config.extraArgs);

    // Estratégias progressivas para TikTok (plataforma mais problemática)
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

    if (!fs.existsSync('downloads')) {
      fs.mkdirSync('downloads');
    }

    console.log('🚀 Executando:', 'yt-dlp', args.join(' '));

    const ytDlp = spawn('yt-dlp', args);
    let errorOutput = '';
    let stdoutOutput = '';

    ytDlp.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutOutput += output;
      console.log(`yt-dlp: ${output}`);
    });

    ytDlp.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      console.error(`yt-dlp stderr: ${output}`);
    });

    ytDlp.on('error', (err) => {
      console.error(`❌ Erro ao iniciar yt-dlp: ${err.message}`);
      reject({ error: 'Erro ao iniciar yt-dlp', details: err.message });
    });

    ytDlp.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Download concluído com sucesso!');
        
        // Buscar o arquivo mais recente
        const files = fs.readdirSync('downloads');
        if (files.length === 0) {
          console.error('⚠️ Nenhum arquivo encontrado após download');
          reject({ error: 'Nenhum arquivo foi salvo' });
          return;
        }

        const filesWithStats = files.map(file => ({
          name: file,
          mtime: fs.statSync(path.join(__dirname, 'downloads', file)).mtime.getTime()
        }));

        filesWithStats.sort((a, b) => b.mtime - a.mtime);
        const lastFile = filesWithStats[0].name;
        
        console.log(`📁 Arquivo salvo: ${lastFile}`);
        resolve({ success: true, file: lastFile, tentativas: tentativa });
      } else {
        console.error(`❌ yt-dlp terminou com código ${code}`);
        
        // Analisar erro e decidir se deve tentar novamente
        const deveRetry = errorOutput.includes('requiring login') || 
                         errorOutput.includes('Sign in to confirm') ||
                         errorOutput.includes('HTTP Error 403') ||
                         errorOutput.includes('Unable to extract');

        if (deveRetry && tentativa < maxTentativas) {
          console.log(`🔄 Tentando novamente... (${tentativa + 1}/${maxTentativas})`);
          // Aguardar 2 segundos antes de tentar novamente
          setTimeout(() => {
            tentarDownload(url, browser, tentativa + 1, maxTentativas)
              .then(resolve)
              .catch(reject);
          }, 2000);
        } else {
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

// Rota para download com retry automático
app.post('/download', async (req, res) => {
  const { url, browser = 'brave' } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL não fornecida' });
  }

  const cleanUrl = url.trim();
  const config = getPlataformaConfig(cleanUrl);

  console.log(`\n${'🎬'.repeat(30)}`);
  console.log(`🆕 Nova requisição de download`);
  console.log(`📱 Plataforma detectada: ${config.plataforma}`);
  console.log(`🌐 Navegador: ${browser}`);
  console.log(`${'🎬'.repeat(30)}\n`);

  try {
    const resultado = await tentarDownload(cleanUrl, browser, 1, config.retries);
    res.json(resultado);
  } catch (error) {
    console.error('❌ Erro final:', error);
    
    // Resposta de erro mais informativa
    const errorResponse = {
      error: error.error || 'Erro desconhecido',
      plataforma: config.plataforma,
      sugestoes: []
    };

    // Adicionar sugestões específicas baseadas no erro
    if (error.details && error.details.includes('requiring login')) {
      errorResponse.sugestoes.push(
        'Faça login no ' + config.plataforma + ' no navegador ' + browser,
        'Certifique-se de que o navegador está fechado',
        'Tente limpar cookies e fazer login novamente',
        'Se estiver usando Brave, tente com Firefox ou Chrome'
      );
    }

    if (error.details && error.details.includes('HTTP Error 403')) {
      errorResponse.sugestoes.push(
        'O conteúdo pode estar restrito geograficamente',
        'Tente usar uma VPN',
        'Verifique se o vídeo é público'
      );
    }

    if (error.details && error.details.includes('Video unavailable')) {
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
      }
    });
  } else {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// Nova rota: Limpar arquivos antigos (opcional)
app.post('/cleanup', (req, res) => {
  try {
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
    res.status(500).json({ error: 'Erro ao limpar arquivos' });
  }
});

// Nova rota: Status do sistema
app.get('/status', (req, res) => {
  const status = {
    online: true,
    downloads_folder: fs.existsSync('downloads'),
    files_count: fs.existsSync('downloads') ? fs.readdirSync('downloads').length : 0,
    navegadores_disponiveis: []
  };

  // Verificar navegadores disponíveis
  ['brave', 'chrome', 'chromium', 'firefox', 'edge'].forEach(browser => {
    const caminho = getCaminhoDoNavegador(browser);
    if (caminho.startsWith(browser + ':')) {
      // Se começou com 'browser:', encontrou o caminho
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
