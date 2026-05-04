import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// Завантаження змінних із файлу .env
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://vv@localhost:5432/tel_bot_store?schema=public",
  }
});
