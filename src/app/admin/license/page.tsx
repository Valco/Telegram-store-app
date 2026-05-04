import { redirect } from 'next/navigation';
import { getLicenseInfo } from '@/lib/license';
import LicenseClient from './LicenseClient';

export default async function LicensePage() {
  const licenseInfo = await getLicenseInfo();

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          🔑 Управління Ліцензією
        </h1>
        <p className="text-neutral-400 mt-2 max-w-2xl">
          Керування доступом до PRO функцій. Введіть ліцензійний ключ для активації SMM, AI та інших преміум можливостей.
        </p>
      </header>

      <LicenseClient initialLicense={licenseInfo} />
    </div>
  );
}
