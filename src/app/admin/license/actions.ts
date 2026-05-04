'use server';

import fs from 'fs/promises';
import path from 'path';

export async function saveLicenseKey(key: string) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = await fs.readFile(envPath, 'utf8');

    // Replace or append LICENSE_KEY
    if (envContent.includes('LICENSE_KEY=')) {
      envContent = envContent.replace(/LICENSE_KEY=.*(\r?\n|$)/g, `LICENSE_KEY="${key}"\n`);
    } else {
      envContent += `\nLICENSE_KEY="${key}"\n`;
    }

    await fs.writeFile(envPath, envContent, 'utf8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
