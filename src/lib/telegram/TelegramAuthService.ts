import crypto from 'crypto';

export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export class TelegramAuthService {
  private botToken: string;

  constructor() {
    // Should be stored securely in environment variables
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  }

  /**
   * Verifies the initData string passed from Telegram WebApp
   * @param initData The raw initData query string from window.Telegram.WebApp.initData
   * @param expiresInSeconds Optional: reject if auth_date is older than this (default: 24 hours)
   * @returns TelegramUserData if valid, throws Error if invalid
   */
  public verifyInitData(initData: string, expiresInSeconds: number = 86400): TelegramUserData {
    if (!this.botToken) {
      throw new Error('Telegram Bot Token is not configured on the server.');
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      throw new Error('Invalid initData: hash is missing');
    }

    // Remove hash to create the data-check-string
    urlParams.delete('hash');
    
    // Sort parameters alphabetically by key
    const keys = Array.from(urlParams.keys()).sort();
    
    const dataCheckArr: string[] = [];
    for (const key of keys) {
      dataCheckArr.push(`${key}=${urlParams.get(key)}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    // Create a secret key based on the bot token using WebAppData constant
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(this.botToken).digest();

    // Calculate the HMAC signature of the data-check-string
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      throw new Error('Telegram verification failed: Invalid signature');
    }

    // Check expiration to prevent replay attacks
    const authDateStr = urlParams.get('auth_date');
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - authDate > expiresInSeconds) {
        throw new Error('Telegram verification failed: initData has expired');
      }
    }

    // Extract and parse user data
    const userStr = urlParams.get('user');
    if (!userStr) {
      throw new Error('Telegram verification failed: User data missing');
    }

    try {
      const user: TelegramUserData = JSON.parse(userStr);
      return user;
    } catch (e) {
      throw new Error('Telegram verification failed: Could not parse user JSON format');
    }
  }
}

export const telegramAuth = new TelegramAuthService();
