import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { cityRef, query } = await request.json();
    if (!cityRef) {
      return NextResponse.json({ error: 'cityRef is required' }, { status: 400 });
    }

    const API_KEY = process.env.NOVA_POSHTA_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'Nova Poshta API key is missing' }, { status: 500 });
    }

    const payload: any = {
      apiKey: API_KEY,
      modelName: 'Address',
      calledMethod: 'getWarehouses',
      methodProperties: {
        CityRef: cityRef,
        Limit: '100'
      }
    };

    if (query) {
      payload.methodProperties.FindByString = query;
    }

    const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      const branches = data.data.map((branch: any) => ({
        ref: branch.Ref,
        name: branch.Description,
        type: branch.CategoryOfWarehouse // Optionally use for icon mapping
      }));
      return NextResponse.json({ success: true, data: branches });
    }

    return NextResponse.json({ error: data.errors?.[0] || 'NP API error' }, { status: 400 });
  } catch (error) {
    console.error('NP Branches Error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}
