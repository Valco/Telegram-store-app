export interface MonobankInvoiceRequest {
  amount: number; // in kopecks (cents)
  ccy?: number; // 980 for UAH
  merchantPaymInfo: {
    reference: string; // our internal Order ID
    destination: string; // Description like "Order #12312"
    basketOrder?: Array<{
      name: string;
      qty: number;
      sum: number;
      code?: string;
    }>;
  };
  redirectUrl: string;       // Where to return user after payment
  webHookUrl: string;        // Webhook for server-to-server confirmation
  validity?: number;         // Time the invoice is valid (in seconds)
}

export interface MonobankInvoiceResponse {
  invoiceId: string;
  pageUrl: string;
}

export class MonobankService {
  private readonly baseUrl = 'https://api.monobank.ua/api/merchant/invoice/create';
  private readonly xToken: string;

  constructor() {
    this.xToken = process.env.MONOBANK_API_KEY || '';
  }

  /**
   * Створює рахунок (посилання на сторінку оплати) в Monobank.
   * @param request Параметри рахунку
   * @returns Посилання на сторінку оплати, на яку треба переадресувати користувача
   */
  async createInvoice(request: MonobankInvoiceRequest): Promise<MonobankInvoiceResponse> {
    if (!this.xToken) {
      throw new Error('Monobank API key is not configured');
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token': this.xToken,
      },
      body: JSON.stringify({
        ...request,
        ccy: request.ccy || 980, 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Monobank Invoice ERROR:', errorText);
      throw new Error(`Failed to create Monobank invoice: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      invoiceId: data.invoiceId,
      pageUrl: data.pageUrl,
    };
  }
}

export const monobankService = new MonobankService();
