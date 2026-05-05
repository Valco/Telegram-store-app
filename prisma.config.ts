import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// Завантаження змінних із файлу .env
dotenv.config();

export default defineConfig({
  migrations: {
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://vv@localhost:5432/tel_bot_store?schema=public",
  }
});
