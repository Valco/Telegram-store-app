import { getSocialPosts } from './actions';
import SMMClient from './SMMClient';

export default async function SMMPage() {
  const response = await getSocialPosts();
  const posts = response.data || [];

  return (
    <div className="p-6">
       <div className="mb-6">
          <h1 className="text-3xl font-black text-white">SMM Контент</h1>
          <p className="text-neutral-400 mt-1">Керування згенерованими постами та авто-публікаціями.</p>
       </div>
       <SMMClient initialPosts={posts} />
    </div>
  );
}
