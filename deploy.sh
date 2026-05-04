#!/bin/bash

# =====================================================================
# Завантажуємо параметри деплою з .env
# Відредагуйте .env та заповніть секцію DEPLOY SETTINGS перед запуском
# =====================================================================
if [ -f ".env" ]; then
  export $(grep -E '^DEPLOY_' .env | xargs)
else
  echo "❌ Файл .env не знайдено! Скопіюйте .env.example → .env та заповніть DEPLOY_* змінні."
  exit 1
fi

USER="${DEPLOY_USER:?DEPLOY_USER не вказано в .env}"
HOST="${DEPLOY_HOST:?DEPLOY_HOST не вказано в .env}"
PORT="${DEPLOY_PORT:-22}"
PROJECT_DIR="${DEPLOY_PROJECT_DIR:-~/projects/store}"
PM2_NAME="${DEPLOY_PM2_NAME:-store-app}"
NEXTJS_PORT="${DEPLOY_NEXTJS_PORT:-4000}"

echo "====================================="
echo "🚀 Розпочинаємо деплой Telegram Store"
echo "   Сервер: ${USER}@${HOST}:${PORT}"
echo "   Директорія: ${PROJECT_DIR}"
echo "====================================="

# 1. Синхронізація файлів через rsync
# Виключаємо непотрібні папки, аби не переписувати .env та не лити важкі білди
echo "[1/3] Завантажуємо оновлення на сервер через rsync..."
rsync -avz --exclude 'node_modules' \
           --exclude '.next' \
           --exclude '.git' \
           --exclude '.env' \
           --exclude 'playwright-report' \
           --exclude 'test-results' \
           --exclude 'uploads' \
           -e "ssh -p ${PORT}" \
           ./ ${USER}@${HOST}:${PROJECT_DIR}/

if [ $? -ne 0 ]; then
  echo "❌ Помилка завантаження файлів."
  exit 1
fi
echo "✅ Файли завантажено успішно."

# 2. Збірка (Build) на сервері та перезапуск
echo "[2/3] Підключення до сервера для збірки та рестарту..."

ssh -p ${PORT} ${USER}@${HOST} "
  cd ${PROJECT_DIR} &&
  rm -f export_data.ts import_data.ts db_dump.json full_data.sql &&
  echo '🔧 Налаштування бойового .env...' &&
  cp .env.production .env &&

  echo '🧹 Очищення застарілих файлів...' &&
  rm -rf src/app/api/dev-test-bg &&
  rm -rf .next &&

  echo '📦 Встановлення NPM пакетів...' &&
  npm install &&

  echo '🗄 Синхронізація Prisma Schema...' &&
  npx prisma generate &&
  npx prisma db push --accept-data-loss &&

  echo '🏗 Збірка Next.js (npm run build)...' &&
  npm run build &&

  echo '🔄 Перезапуск у PM2...' &&
  { pm2 delete ${PM2_NAME} || true; } &&
  pm2 start npm --name '${PM2_NAME}' -- start -- --port ${NEXTJS_PORT} &&
  pm2 save
"

if [ $? -ne 0 ]; then
  echo "❌ Помилка збірки/рестарту на сервері."
  exit 1
fi

echo "====================================="
echo "✅ ДЕПЛОЙ УСПІШНИЙ!"
echo "Ваш магазин працює на порту ${NEXTJS_PORT} (внутрішній сервер)."
echo "Не забудьте перезапустити nginx (sudo systemctl reload nginx)."
echo "====================================="
