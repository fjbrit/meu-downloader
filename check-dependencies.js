#!/usr/bin/env node

/**
 * Script para verificar se todas as dependências do sistema estão instaladas
 * Verifica: yt-dlp, navegadores, ffmpeg
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Tentar carregar chalk para logs coloridos (opcional)
let chalk;
try {
  chalk = require('chalk');
} catch (e) {
  // Fallback caso chalk não esteja instalado
  chalk = {
    green: (str) => str,
    red: (str) => str,
    yellow: (str) => str,
    blue: (str) => str,
    cyan: (str) => str,
    bold: (str) => str
  };
}

function checkCommand(command, errorMessage) {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch (error) {
    if (errorMessage) {
      console.error(chalk.red('❌'), errorMessage);
    }
    return false;
  }
}

function checkYtDlp() {
  const isInstalled = checkCommand('yt-dlp --version', '');
  if (isInstalled) {
    const version = execSync('yt-dlp --version', { encoding: 'utf-8' }).trim();
    console.log(chalk.green('✅'), `yt-dlp ${version} instalado`);
    return true;
  } else {
    console.error(chalk.red('❌'), 'yt-dlp não encontrado. Instale com:');
    console.error('   sudo apt install yt-dlp');
    console.error('   ou pip install yt-dlp');
    return false;
  }
}

function checkFfmpeg() {
  const isInstalled = checkCommand('ffmpeg -version', '');
  if (isInstalled) {
    const versionOutput = execSync('ffmpeg -version', { encoding: 'utf-8' }).split('\n')[0];
    console.log(chalk.green('✅'), `ffmpeg ${versionOutput.split(' ')[2]} instalado`);
    return true;
  } else {
    console.warn(chalk.yellow('⚠️'), 'ffmpeg não encontrado (opcional para alguns formatos)');
    return false;
  }
}

function checkBrowsers() {
  const browsers = [
    { name: 'Brave', cmd: 'brave-browser --version', path: ['/usr/bin/brave-browser', '/var/lib/flatpak/exports/bin/com.brave.Browser'] },
    { name: 'Chrome', cmd: 'google-chrome --version', path: ['/usr/bin/google-chrome'] },
    { name: 'Firefox', cmd: 'firefox --version', path: ['/usr/bin/firefox'] },
    { name: 'Edge', cmd: 'microsoft-edge --version', path: ['/usr/bin/microsoft-edge'] }
  ];

  let foundBrowsers = [];
  browsers.forEach(browser => {
    try {
      // Tenta pelo comando
      execSync(browser.cmd, { stdio: 'ignore' });
      foundBrowsers.push(browser.name);
      console.log(chalk.green('✅'), `${browser.name} encontrado`);
    } catch (e) {
      // Tenta pelo caminho do executável
      const found = browser.path.some(p => fs.existsSync(p));
      if (found) {
        foundBrowsers.push(browser.name);
        console.log(chalk.green('✅'), `${browser.name} encontrado (via caminho)`);
      } else {
        console.warn(chalk.yellow('⚠️'), `${browser.name} não encontrado`);
      }
    }
  });

  return foundBrowsers;
}

function checkFolders() {
  const requiredFolders = ['downloads'];
  requiredFolders.forEach(folder => {
    if (!fs.existsSync(folder)) {
      console.log(chalk.blue('📁'), `Criando pasta ${folder}...`);
      fs.mkdirSync(folder);
    } else {
      console.log(chalk.green('✅'), `Pasta ${folder} pronta`);
    }
  });
}

function main() {
  console.log(chalk.cyan.bold('\n🔍 Verificando dependências do sistema...\n'));

  const checks = [
    () => checkYtDlp(),
    () => checkFfmpeg(),
    () => {
      console.log(chalk.cyan('\n🌐 Verificando navegadores...\n'));
      const browsers = checkBrowsers();
      if (browsers.length > 0) {
        console.log(chalk.green('✅'), `Navegadores encontrados: ${browsers.join(', ')}`);
      } else {
        console.warn(chalk.yellow('⚠️'), 'Nenhum navegador compatível encontrado');
      }
      return browsers.length > 0;
    },
    () => {
      console.log(chalk.cyan('\n📂 Verificando pastas...\n'));
      checkFolders();
      return true;
    }
  ];

  let allPassed = true;
  for (const check of checks) {
    if (!check()) {
      allPassed = false;
    }
  }

  console.log(chalk.cyan.bold('\n--- Resumo ---'));
  if (allPassed) {
    console.log(chalk.green('✅'), 'Sistema pronto para uso!');
  } else {
    console.log(chalk.red('❌'), 'Algumas dependências estão faltando. Veja os erros acima.');
  }
  console.log('');
}

// Exporta função para uso em outros scripts
module.exports.checkYtDlp = checkYtDlp;
module.exports.checkFfmpeg = checkFfmpeg;
module.exports.checkBrowsers = checkBrowsers;
module.exports.checkFolders = checkFolders;

// Executa se chamado diretamente
if (require.main === module) {
  main();
}