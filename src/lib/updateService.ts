import prisma from '@/lib/prisma';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseNotes: string | null;
  releaseUrl: string | null;
  checkedAt: string;
}

const REPO = 'Valco/Telegram-store-app';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function checkForUpdates(): Promise<UpdateInfo> {
  const pkg = await import('../../package.json');
  const currentVersion = pkg.version || '1.0.0';

  // Check cached result in Settings
  try {
    const settings = await prisma.settings.findFirst({
      select: { updateCheckCache: true, updateCheckCachedAt: true } as any,
    }) as any;

    const cachedAt = settings?.updateCheckCachedAt ? new Date(settings.updateCheckCachedAt) : null;
    const now = new Date();

    // Use cache if < 24h old
    if (cachedAt && (now.getTime() - cachedAt.getTime()) < CHECK_INTERVAL_MS && settings?.updateCheckCache) {
      const cached = JSON.parse(settings.updateCheckCache);
      return { ...cached, currentVersion };
    }
  } catch (_) {}

  // Fetch from GitHub API
  try {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = { 'User-Agent': 'TelegramStore/1.0' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) throw new Error('GitHub API error');

    const data = await res.json();
    const latestVersion = (data.tag_name as string).replace(/^v/, '');

    const result: UpdateInfo = {
      currentVersion,
      latestVersion,
      hasUpdate: latestVersion !== currentVersion,
      releaseNotes: data.body || null,
      releaseUrl: data.html_url || null,
      checkedAt: new Date().toISOString(),
    };

    // Cache to DB
    try {
      const s = await prisma.settings.findFirst();
      if (s) {
        await (prisma.settings.update as any)({
          where: { id: s.id },
          data: {
            updateCheckCache: JSON.stringify(result),
            updateCheckCachedAt: new Date(),
          },
        });
      }
    } catch (_) {}

    return result;
  } catch (e) {
    return {
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      releaseNotes: null,
      releaseUrl: null,
      checkedAt: new Date().toISOString(),
    };
  }
}
