export interface NovaPoshtaCity {
  Ref: string;
  Description: string;
  AreaDescription: string;
  SettlementTypeDescription: string;
}

export interface NovaPoshtaBranch {
  Ref: string;
  Description: string;
  ShortAddress: string;
  Number: string;
}

export class NovaPoshtaService {
  private readonly baseUrl = 'https://api.novaposhta.ua/v2.0/json/';
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.NOVA_POSHTA_API_KEY || '';
  }

  /**
   * Generic method to make structured requests to Nova Poshta API
   */
  private async makeRequest(modelName: string, calledMethod: string, methodProperties: any = {}) {
    if (!this.apiKey) {
      console.warn('Nova Poshta API Key not configured. Using dummy/empty response for development.');
    }

    const payload = {
      apiKey: this.apiKey,
      modelName,
      calledMethod,
      methodProperties,
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Nova Poshta API Error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(`NP Error: ${data.errors?.join(', ') || 'Unknown NP error'}`);
    }

    return data.data;
  }

  /**
   * Search for cities to display in the autocomplete dropdown
   * @param searchString text user typed in the dropdown input
   */
  async searchCities(searchString: string): Promise<NovaPoshtaCity[]> {
    if (!searchString || searchString.length < 2) return [];

    const data = await this.makeRequest('Address', 'searchSettlements', {
      CityName: searchString,
      Limit: '50',
    });

    // The API returns Addresses[0].Addresses array for this specific endpoint
    if (data && data[0] && data[0].Addresses) {
      return data[0].Addresses.map((res: any) => ({
        Ref: res.DeliveryCity, 
        Description: res.MainDescription,
        AreaDescription: res.Area,
        SettlementTypeDescription: res.SettlementTypeCode,
      }));
    }
    
    return [];
  }

  /**
   * Fetch branches (post offices/parcel lockers) for a selected city
   * @param cityRef The unique 'Ref' identifier from the city response
   */
  async getBranches(cityRef: string): Promise<NovaPoshtaBranch[]> {
    const data = await this.makeRequest('Address', 'getWarehouses', {
      CityRef: cityRef,
    });

    return data.map((branch: any) => ({
      Ref: branch.Ref,
      Description: branch.Description,
      ShortAddress: branch.ShortAddress,
      Number: branch.Number,
    }));
  }
}

export const novaPoshtaService = new NovaPoshtaService();
