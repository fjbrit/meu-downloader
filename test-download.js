#!/usr/bin/env node

/**
 * Script para testar se o servidor está funcionando
 */

const { execSync } = require('child_process');
const http = require('http');

// Tentar carregar chalk para logs coloridos (opcional)
let chalk;
try {
  chalk = require('chalk');
} catch (e) {
  chalk = {
    green: (str) => str,
    red: (str) => str,
    yellow: (str) => str,
    blue: (str) => str,
    cyan: (str) => str,
    bold: (str) => str
  };
}

function testServerOnline() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:3000/status', (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    }).on('error', (err) => {
      resolve(false);
    });

    // Timeout para evitar travar
    req.setTimeout(3000, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function main() {
  console.log(chalk.cyan.bold('\n🧪 Testando sistema...\n'));

  // Verifica se o servidor está online
  const isOnline = await testServerOnline();
  if (isOnline) {
    console.log(chalk.green('✅'), 'Servidor está online!');
  } else {
    console.log(chalk.red('❌'), 'Servidor não responde. Inicie com `npm start` ou `npm run dev`');
    return;
  }

  // Verifica se yt-dlp está instalado
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    console.log(chalk.green('✅'), 'yt-dlp está instalado');
  } catch (error) {
    console.log(chalk.red('❌'), 'yt-dlp não encontrado. Instale com `npm run update-ytdlp`');
    return;
  }

  // Verifica navegadores disponíveis
  console.log(chalk.cyan('\n🌐 Navegadores disponíveis:\n'));
  try {
    const { checkBrowsers } = require('./check-dependencies.js');
    const browsers = checkBrowsers();
    if (browsers.length > 0) {
      console.log(chalk.green('✅'), `Navegadores encontrados: ${browsers.join(', ')}`);
    } else {
      console.log(chalk.yellow('⚠️'), 'Nenhum navegador compatível encontrado');
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️'), 'Não foi possível verificar navegadores:', error.message);
  }

  console.log(chalk.cyan.bold('\n🎉 Sistema está funcionando corretamente!\n'));
  console.log(chalk.blue('💡 Exemplo de uso:'));
  console.log('   curl -X POST http://localhost:3000/download \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"url":"https://youtu.be/dQw4w9WgXcQ", "browser":"brave"}\'');
  console.log('');
}

main();