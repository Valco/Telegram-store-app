export interface ReceiptItem {
  code: string;
  name: string;
  price: number; // in kopecks
  quantity: number;
}

export interface FiscalReceiptResponse {
  receiptId: string;
  receiptUrl: string; // The URL to view/download the receipt (provided by Checkbox or our backend)
}

/**
 * Service to handle dynamic Electronic Fiscal Receipts (ПРРО)
 * using Checkbox.ua (Standard provider in Ukraine). 
 */
export class CheckboxService {
  private readonly baseUrl = 'https://api.checkbox.in.ua/api/v1';
  private readonly xLicenseKey: string;

  constructor() {
    this.xLicenseKey = process.env.CHECKBOX_LICENSE_KEY || '';
  }

  /**
   * Generates a fiscal receipt in the Tax Office (ДПС) 
   * @param orderId Internal order ID
   * @param items Array of purchased items and quantities 
   * @param totalCents The total amount paid after coin discounts
   * @param paymentType Cashless, Card, Monobank
   */
  async createReceipt(
    orderId: string, 
    items: ReceiptItem[], 
    totalCents: number,
    paymentType: string = 'CASHLESS'
  ): Promise<FiscalReceiptResponse> {
    if (!this.xLicenseKey) {
      console.warn('Checkbox.ua API is not configured. Simulating fiscalization for Order:', orderId);
      return {
        receiptId: `MOCK-CHK-${Date.now()}`,
        receiptUrl: `https://my.checkbox.ua/receipts/mock-receipt`
      };
    }

    // Example payload for Checkbox.ua 
    // Requires a bearer token (from login) and X-License-Key
    // 1. Authenticate Cashier (Requires login & password or token)
    // 2. Open Shift (if not already opened)
    // 3. Create Receipt (POST /receipts/sell)
    // 4. (Optional) Close Shift at end of day (Cron Job)

    // For demonstration, simulating successful response:
    throw new Error('Not fully implemented yet. Requires Cashier Token generation.');
  }

  /**
   * Helper to automatically send the receipt URL via Telegram notification
   */
  async sendReceiptToTelegram(telegramUserId: string, receiptUrl: string) {
    // Logic to send message directly via Telegram Bot API
    // `Your payment is successful! View your official tax receipt here: ${receiptUrl}`
  }
}

export const checkboxService = new CheckboxService();
