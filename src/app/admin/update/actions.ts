'use server';

import { checkForUpdates } from '@/lib/updateService';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const PROJECT_DIR = process.env.DEPLOY_PROJECT_DIR?.replace('~', process.env.HOME || '/root') 
  || path.resolve(process.cwd());

export async function getUpdateStatus() {
  try {
    const info = await checkForUpdates();
    return { success: true, data: info };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function performUpdate() {
  try {
    const steps: string[] = [];

    const run = async (cmd: string, label: string) => {
      steps.push(`⏳ ${label}...`);
      const { stdout, stderr } = await execAsync(cmd, { cwd: PROJECT_DIR });
      steps.push(`✅ ${label} — готово`);
      return stdout + stderr;
    };

    await run('git pull origin main', 'Завантаження оновлень');
    await run('npm install --omit=dev', 'Встановлення пакетів');
    await run('npx prisma db push --accept-data-loss', 'Оновлення бази даних');
    await run('npm run build', 'Збірка проекту');

    const pm2Name = process.env.DEPLOY_PM2_NAME || 'store-app';
    await run(`pm2 restart ${pm2Name}`, 'Перезапуск сервера');

    return { success: true, steps };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
