'use server';

import prisma from '@/lib/prisma';
import { encryptJWT } from '@/lib/auth';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';

async function getSiteName(): Promise<string> {
  try {
    const s = await prisma.settings.findFirst({ select: { siteName: true } });
    return s?.siteName || 'Telegram Store';
  } catch { return 'Telegram Store'; }
}

async function setAdminSessionCookie(user: any) {
  const sessionCookie = await encryptJWT({
    userId: user.id,
    email: user.email || undefined,
    role: user.accessGroup?.name || 'Unknown',
    dbRole: user.role,
    permissions: user.accessGroup?.permissions || []
  });

  const cookieStore = await cookies();
  cookieStore.set('adminSession', sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60 * 60, // 5 hours
  });
}

export async function loginAdmin(formData: FormData) {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return { success: false, error: 'Заповніть всі поля' };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { accessGroup: true }
    });

    if (!user || user.role !== 'STAFF') {
      return { success: false, error: 'Доступ заборонено (Користувача не знайдено)' };
    }

    // Usually we would bcrypt.compare(password, user.passwordHash)
    // Here we are comparing direct values as instructed for the mock setup
    if (user.passwordHash !== password) {
      return { success: false, error: 'Невірний пароль' };
    }

    // OTP Check step
    if (user.requiresOtp) {
      if (!user.email) {
        return { success: false, error: 'Користувач не має email, неможливо відправити OTP' };
      }

      const siteName = await getSiteName();
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
      
      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode, otpExpiresAt }
      });
      
      // Try SMTP First
      let sentViaEmail = false;
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_PORT === '465',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });

          await transporter.sendMail({
            from: `"${siteName} Admin" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: '🔒 Код підтвердження для входу',
            html: `
              <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                <h2>Код для входу в панель управління</h2>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #4f46e5;">${otpCode}</p>
                <p style="color: #666; font-size: 12px;">Код дійсний 5 хвилин.</p>
              </div>
            `
          });
          sentViaEmail = true;
        } catch (err) {
          console.error("Failed to send OTP via Email (SMTP):", err);
        }
      }

      // Fallback or secondary send via Telegram if connected
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken && user.telegramId) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: user.telegramId.toString(),
              text: `🔒 Ваш код для входу в Adminius:\n\n*${otpCode}*\n\n_Дійсний 5 хвилин._`,
              parse_mode: 'Markdown'
            })
          });
        } catch (err) {
           console.error("Failed to send OTP via Telegram:", err);
        }
      }

      if (!sentViaEmail && !user.telegramId) {
         return { success: false, error: 'Неможливо відправити OTP: не налаштований SMTP та не прив\'язаний Telegram' };
      }

      return { success: true, requireOtp: true, userId: user.id };
    }

    // Successful Login without OTP
    await setAdminSessionCookie(user);

    return { success: true, requireOtp: false };
  } catch (error: any) {
    console.error('Login Error:', error);
    return { success: false, error: 'Внутрішня помилка сервера' };
  }
}

export async function verifyAdminOtp(formData: FormData) {
  try {
    const userId = formData.get('userId') as string;
    const code = formData.get('code') as string;

    if (!userId || !code) {
      return { success: false, error: 'Відсутні дані для перевірки' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { accessGroup: true }
    });

    if (!user || user.role !== 'STAFF') {
      return { success: false, error: 'Доступ заборонено (Користувача не знайдено)' };
    }

    if (user.otpCode !== code) {
      return { success: false, error: 'Невірний OTP код' };
    }

    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return { success: false, error: 'Час дії OTP коду вичерпано. Перезавантажте сторінку та спробуйте знову.' };
    }

    // Clear OTP Code and create session
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiresAt: null }
    });

    await setAdminSessionCookie(user);

    return { success: true };
  } catch (error: any) {
    console.error('OTP Verify Error:', error);
    return { success: false, error: 'Внутрішня помилка сервера' };
  }
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete('adminSession');
  return { success: true };
}
