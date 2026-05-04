import { getAbandonedCarts } from './actions';
import CartsClient from './CartsClient';

export default async function AbandonedCartsPage() {
  const response = await getAbandonedCarts();
  const carts = response.data || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white/5 border border-white/10 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Покинуті Кошики</h2>
          <p className="text-sm text-neutral-400">Користувачі, які додали товари, але не завершили оплату.</p>
        </div>
      </div>

      <CartsClient carts={carts} />
    </div>
  );
}
