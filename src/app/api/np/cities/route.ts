import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query || query.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const API_KEY = process.env.NOVA_POSHTA_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'Nova Poshta API key is missing' }, { status: 500 });
    }

    const payload = {
      apiKey: API_KEY,
      modelName: 'Address',
      calledMethod: 'getCities',
      methodProperties: {
        FindByString: query,
        Limit: '20'
      }
    };

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      const cities = data.data.map((city: any) => ({
        ref: city.Ref,
        name: city.Description,
        type: city.SettlementTypeDescription, // e.g. "місто", "селище міського типу"
        area: city.AreaDescription
      }));
      return NextResponse.json({ success: true, data: cities });
    }

    return NextResponse.json({ error: data.errors?.[0] || 'NP API error' }, { status: 400 });
  } catch (error) {
    console.error('NP Cities Error:', error);
    return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 500 });
  }
}
