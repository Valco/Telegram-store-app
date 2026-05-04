import { getCustomers } from './actions';
import CustomerClient from './CustomerClient';

export default async function CustomersPage() {
  const response = await getCustomers();
  const customers = response.data || [];

  return <CustomerClient customers={JSON.parse(JSON.stringify(customers, (k, v) => typeof v === 'bigint' ? v.toString() : v))} />;
}
