'use server';

import prisma from '@/lib/prisma';
import https from 'https';
import { getLicenseInfo } from '@/lib/license';

export async function runSystemDiagnostics() {
  const t0 = performance.now();
  const report: any = {
    db: { status: 'loading', message: '', latencyMs: 0 },
    bot: { status: 'loading', message: '', latencyMs: 0 },
    ssl: { status: 'loading', message: '', latencyMs: 0, daysLeft: 0, validTo: '' },
    system: { uptimeSec: 0, ramMb: 0 },
    license: { valid: false, plan: 'free', features: [], daysLeft: 0, expiresAt: '' }
  };

  // 1. DB Connect Test
  try {
    const dbStart = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    report.db = { 
      status: 'online', 
      message: 'База даних PostgreSQL підключена та активна',
      latencyMs: Math.round(performance.now() - dbStart) 
    };
  } catch (error: any) {
    report.db = { status: 'error', message: error.message || 'Відмова бази даних', latencyMs: 0 };
  }

  // 2. Telegram Bot API Ping
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    report.bot = { status: 'error', message: 'TELEGRAM_BOT_TOKEN відсутній в .env', latencyMs: 0 };
  } else {
    try {
      const botStart = performance.now();
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const body = await res.json();
      if (res.ok && body.ok) {
        report.bot = { 
          status: 'online', 
          message: `Авторизовано як @${body.result.username}`,
          latencyMs: Math.round(performance.now() - botStart)
        };
      } else {
        report.bot = { status: 'error', message: body.description || 'Помилка API', latencyMs: 0 };
      }
    } catch (error: any) {
      report.bot = { status: 'error', message: error.message || 'Таймаут з\'єднання', latencyMs: 0 };
    }
  }

  // 3. SSL Status Check
  const domainUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com';
  try {
    const sslStart = performance.now();
    await new Promise((resolve, reject) => {
      const req = https.request(domainUrl, { method: 'HEAD' }, (res) => {
        const cert = (res.socket as any).getPeerCertificate();
        if (cert && Object.keys(cert).length > 0) {
          const validTo = new Date(cert.valid_to);
          const daysLeft = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          
          report.ssl = {
            status: daysLeft < 7 ? 'warning' : 'online',
            message: daysLeft < 0 ? 'Сертифікат протерміновано!' : `Захищено. Дійсний ще ${daysLeft} днів.`,
            daysLeft: daysLeft,
            validTo: validTo.toLocaleDateString('uk-UA'),
            latencyMs: Math.round(performance.now() - sslStart)
          };
          resolve(true);
        } else {
          reject(new Error('Не вдалося отримати сертифікат'));
        }
      });
      req.on('error', reject);
      req.end();
    });
  } catch (error: any) {
    report.ssl = { status: 'error', message: error.message || 'Помилка підключення до домену', latencyMs: 0, daysLeft: 0 };
  }

  // 4. System Uptime & Memory
  const mem = process.memoryUsage();
  report.system = {
    uptimeSec: Math.floor(process.uptime()),
    ramMb: Math.round(mem.rss / 1024 / 1024)
  };

  // 5. License Check
  try {
    const lic = await getLicenseInfo();
    report.license = {
      valid: lic.valid,
      plan: lic.plan,
      features: lic.features || [],
      daysLeft: lic.daysLeft || 0,
      expiresAt: lic.expiresAt || '',
      reason: lic.reason || '',
    };
  } catch {
    report.license = { valid: false, plan: 'free', features: [], daysLeft: 0, expiresAt: '', reason: 'error' };
  }

  report.totalLatency = Math.round(performance.now() - t0);

  return { success: true, report };
}
