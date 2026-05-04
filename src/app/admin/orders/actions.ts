'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateOrderStatus(orderId: string, status: any) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, error: 'Order not found' };

    const updateData: any = { status };
    let awardedCoins = 0;

    // Handle Cashback if not yet earned and status is successful
    if (!order.cashbackEarned && (status === 'PAID' || status === 'DELIVERED')) {
      const settings = await prisma.settings.findFirst();
      const cashbackPercent = settings?.cashbackPercent || 0;
      const coinToUahRate = settings?.coinToUahRate || 10;
      
      if (cashbackPercent > 0) {
        awardedCoins = Math.floor((order.finalAmount / 100) * (cashbackPercent / 100) * coinToUahRate);
      }
      
      if (awardedCoins > 0) {
        updateData.cashbackEarned = true;
        
        await prisma.user.update({
          where: { id: order.userId },
          data: { coinsBalance: { increment: awardedCoins } }
        });
        
        await prisma.coinsHistory.create({
          data: {
            userId: order.userId,
            amount: awardedCoins,
            reason: `Кешбек за замовлення ${order.orderNumber}`
          }
        });
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });
    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update order status' };
  }
}

export async function updateOrderTTN(orderId: string, ttn: string) {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { novaPoshtaTtn: ttn }
    });
    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update TTN' };
  }
}

export async function checkNovaPoshtaStatus(ttn: string) {
  try {
    const apiKey = process.env.NOVA_POSHTA_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'API ключ Нової Пошти не налаштований у .env' };
    }

    const payload = {
      apiKey: apiKey,
      modelName: 'TrackingDocument',
      calledMethod: 'getStatusDocuments',
      methodProperties: {
        Documents: [
          {
            DocumentNumber: ttn,
            Phone: ''
          }
        ]
      }
    };

    const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (data.success && data.data && data.data.length > 0) {
      const statusDocument = data.data[0];
      return { 
        success: true, 
        status: statusDocument.Status || 'Статус невідомий',
        statusCode: statusDocument.StatusCode 
      };
    } else {
      return { success: false, error: data.errors?.[0] || 'Помилка перевірки ТТН' };
    }
  } catch (error) {
    return { success: false, error: 'Помилка з\'єднання з Новою Поштою' };
  }
}

async function fetchNP(modelName: string, calledMethod: string, methodProperties: any) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY;
  if (!apiKey) throw new Error('API Ключ НП не знайдено');
  const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.errors?.[0] || 'Помилка API Нової Пошти');
  return data;
}

function formatNPPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('380')) return digits;
  if (digits.startsWith('0')) return '38' + digits;
  return '380' + digits;
}

export async function generateNovaPoshtaTTN(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, items: { include: { product: true } } }
    });

    if (!order) return { success: false, error: 'Замовлення не знайдено' };
    if (!order.deliveryCityRef || !order.deliveryBranchRef) {
      return { success: false, error: 'У замовленні відсутні ідентифікатори міста/відділення. Видаліть замовлення або створіть ТТН вручну в додатку НП.' };
    }

    // 1. Get Sender Info
    const senderData = await fetchNP('Counterparty', 'getCounterparties', { CounterpartyProperty: 'Sender' });
    if (!senderData.data || senderData.data.length === 0) return { success: false, error: 'Не знайдено Відправника за цим API Ключем' };
    const sender = senderData.data[0];

    const senderContactData = await fetchNP('Counterparty', 'getCounterpartyContactPersons', { Ref: sender.Ref });
    if (!senderContactData.data || senderContactData.data.length === 0) return { success: false, error: 'Відправник не має контактної особи' };
    const senderContact = senderContactData.data[0];

    const senderAddressData = await fetchNP('Counterparty', 'getCounterpartyAddresses', { Ref: sender.Ref, CounterpartyProperty: 'Sender' });
    if (!senderAddressData.data || senderAddressData.data.length === 0) return { success: false, error: 'Відправник не має збережених адрес' };
    const senderAddress = senderAddressData.data[0];

    // 2. Setup Recipient
    // NP only accepts Cyrillic letters, dashes, and apostrophes
    const cleanNPName = (name: string | null | undefined, fallback: string) => {
      if (!name) return fallback;
      const cleaned = name.replace(/[^А-Яа-яЄєІіЇїҐґ\s\-'`]/g, '').trim();
      return cleaned.length > 0 ? cleaned : fallback;
    };
    
    let fname = cleanNPName(order.user.firstName, 'Клієнт');
    let lname = cleanNPName(order.user.lastName, 'Шановний');
    let phoneNum = order.user.phone ? formatNPPhone(order.user.phone) : '380999999999';

    const recipientData = await fetchNP('Counterparty', 'save', {
      FirstName: fname,
      LastName: lname,
      Phone: phoneNum,
      CounterpartyType: 'PrivatePerson',
      CounterpartyProperty: 'Recipient'
    });
    
    // If saving the private person throws an error (e.g. duplicate contact), we can search it, but usually standard save works or returns existing
    const recipient = recipientData.data[0];
    let recipientContactRef = recipient.ContactPerson?.data?.[0]?.Ref;
    if (!recipientContactRef) {
       // if we didn't get ContactPerson ref back, we fetch it
       const rcData = await fetchNP('Counterparty', 'getCounterpartyContactPersons', { Ref: recipient.Ref });
       recipientContactRef = rcData.data[0].Ref;
    }

    // 3. Document parameters
    const costUAH = Math.max(1, order.finalAmount / 100);
    // User requested sizes: 10x8x12 cm -> m: 0.1 x 0.08 x 0.12 = 0.00096
    const volumeGeneral = "0.00096";
    const weight = "0.5";
    
    // Generate date in Europe/Kyiv timezone to prevent 'Date cannot be less than now' on GMT servers.
    const kyivTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Kyiv"}));
    const dateStr = `${kyivTime.getDate().toString().padStart(2, '0')}.${(kyivTime.getMonth() + 1).toString().padStart(2, '0')}.${kyivTime.getFullYear()}`;

    const documentProperties: any = {
      PayerType: "Recipient",
      PaymentMethod: "Cash",
      DateTime: dateStr,
      CargoType: "Parcel",
      VolumeGeneral: volumeGeneral,
      Weight: weight,
      ServiceType: "WarehouseWarehouse",
      SeatsAmount: "1",
      Description: "Товари з магазину",
      Cost: costUAH.toString(),
      CitySender: "db5c8902-391c-11dd-90d9-001a92567626", // м. Черкаси
      Sender: sender.Ref,
      SenderAddress: "511fcf95-e1c2-11e3-8c4a-0050568002cf", // Відділення №6
      ContactSender: senderContact.Ref,
      SendersPhone: senderContact.Phones,
      CityRecipient: order.deliveryCityRef,
      Recipient: recipient.Ref,
      RecipientAddress: order.deliveryBranchRef,
      ContactRecipient: recipientContactRef,
      RecipientsPhone: phoneNum,
    };

    // If Postpaid (Накладений платіж) -> Add BackwardDeliveryData
    if (order.paymentMethod === 'postpaid') {
      documentProperties.BackwardDeliveryData = [
        {
          PayerType: "Recipient",
          CargoType: "Money",
          RedeliveryString: costUAH.toString()
        }
      ];
    }

    const ttnData = await fetchNP('InternetDocument', 'save', documentProperties);
    const newTtnNumber = ttnData.data[0].IntDocNumber;

    // 4. Save to DB
    await prisma.order.update({
      where: { id: orderId },
      data: { novaPoshtaTtn: newTtnNumber }
    });

    revalidatePath('/admin/orders');
    return { success: true, ttn: newTtnNumber };

  } catch (error: any) {
    console.error('Nova Poshta Generate Error:', error);
    return { success: false, error: error.message || 'Внутрішня помилка при створенні ТТН' };
  }
}

export async function deleteOrder(orderId: string) {
  try {
    // Delete items first, then the order
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    console.error('Delete Order error:', error);
    return { success: false, error: 'Помилка при видаленні замовлення' };
  }
}

export async function updateOrderDetails(orderId: string, formData: FormData) {
  try {
    const deliveryMethod = formData.get('deliveryMethod') as string;
    const deliveryCity = formData.get('deliveryCity') as string;
    const deliveryBranch = formData.get('deliveryBranch') as string;
    const deliveryCityRef = formData.get('deliveryCityRef') as string;
    const deliveryBranchRef = formData.get('deliveryBranchRef') as string;

    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phone = formData.get('phone') as string;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return { success: false, error: 'Замовлення не знайдено' };

    await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryMethod,
        deliveryCity,
        deliveryBranch,
        deliveryCityRef,
        deliveryBranchRef
      }
    });

    if (order.userId) {
      await prisma.user.update({
        where: { id: order.userId },
        data: {
          firstName,
          lastName,
          phone
        }
      });
    }

    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    console.error('Update Order error:', error);
    return { success: false, error: 'Помилка при збереженні деталей' };
  }
}

