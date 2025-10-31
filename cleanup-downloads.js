#!/usr/bin/env node

/**
 * Script para limpar arquivos antigos da pasta downloads
 */

const fs = require('fs');
const path = require('path');

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

// Tempo máximo em milissegundos (padrão: 24 horas)
const MAX_AGE = process.env.MAX_FILE_AGE ? parseInt(process.env.MAX_FILE_AGE) : 24 * 60 * 60 * 1000;

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} dias`;
  if (hours > 0) return `${hours} horas`;
  if (minutes > 0) return `${minutes} minutos`;
  return `${seconds} segundos`;
}

function cleanup() {
  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    console.log(chalk.yellow('⚠️'), 'Pasta downloads não encontrada');
    return;
  }

  const files = fs.readdirSync(downloadsDir);
  const now = Date.now();
  let totalRemoved = 0;
  let totalSizeRemoved = 0;

  console.log(chalk.cyan.bold(`🧹 Limpando arquivos mais antigos que ${formatTime(MAX_AGE)}...\n`));

  files.forEach(file => {
    const filePath = path.join(downloadsDir, file);
    const stats = fs.statSync(filePath);
    const age = now - stats.mtimeMs;

    if (age > MAX_AGE) {
      totalRemoved++;
      totalSizeRemoved += stats.size;
      console.log(chalk.red('🗑️ '), `Removido: ${file} (${formatBytes(stats.size)}, ${formatTime(age)})`);
      fs.unlinkSync(filePath);
    } else {
      console.log(chalk.green('✅'), `Mantido: ${file} (${formatBytes(stats.size)}, ${formatTime(age)})`);
    }
  });

  console.log(chalk.cyan.bold(`\n✨ Limpeza concluída! ${formatBytes(totalSizeRemoved)} liberados em ${totalRemoved} arquivos.\n`));
}

cleanup();