import { getSocialPosts } from './actions';
import SMMClient from './SMMClient';
import { canUseFeature } from '@/lib/license';
import ProFeatureBanner from '@/components/ProFeatureBanner';

export default async function SMMPage() {
  const response = await getSocialPosts();
  const posts = response.data || [];

  const hasFeature = await canUseFeature('SMM');

  return (
    <div className="p-6 relative">
       {!hasFeature && (
         <ProFeatureBanner 
           featureName="SMM Автопостинг" 
           description="Автоматично створюйте та публікуйте контент у соціальних мережах за допомогою ШІ."
         />
       )}
       <div className={`mb-6 ${!hasFeature ? 'opacity-30 blur-sm pointer-events-none' : ''}`}>
          <h1 className="text-3xl font-black text-white">SMM Контент</h1>
          <p className="text-neutral-400 mt-1">Керування згенерованими постами та авто-публікаціями.</p>
       </div>
       <div className={!hasFeature ? 'opacity-30 blur-sm pointer-events-none' : ''}>
         <SMMClient initialPosts={posts} />
       </div>
    </div>
  );
}
