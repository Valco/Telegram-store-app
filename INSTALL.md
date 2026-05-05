# 🛠️ Встановлення на сервер — Покрокова інструкція

> Цей документ написано для людей, які вперше стикаються з налаштуванням сервера і терміналом.
> Читайте уважно кожен крок — не пропускайте жодного.

---

## 📖 Що таке термінал?

**Термінал** — це текстове вікно, в якому ви вводите команди для керування сервером.

Щоб підключитися до сервера з вашого комп'ютера:
- **Mac / Linux:** відкрийте програму **Terminal**
- **Windows:** встановіть [PuTTY](https://putty.org) або використайте **PowerShell**

Команда підключення до сервера:
```bash
ssh ваш_логін@IP-адреса-сервера
```
Наприклад: `ssh root@123.45.67.89`

Після введення команди вас попросять ввести пароль. При введенні пароля символи не відображаються — це нормально. Просто введіть і натисніть Enter.

---

## ✅ КРОК 0: Перевірка встановлених програм

Після підключення до сервера виконайте ці команди — вони перевірять чи все необхідне встановлено.

### Перевірка всього одразу (скопіюйте і вставте блок цілком):

```bash
echo "=== Перевірка програм ===" && \
echo -n "Node.js: " && node --version 2>/dev/null || echo "НЕ ВСТАНОВЛЕНО" && \
echo -n "npm: " && npm --version 2>/dev/null || echo "НЕ ВСТАНОВЛЕНО" && \
echo -n "PostgreSQL: " && psql --version 2>/dev/null || echo "НЕ ВСТАНОВЛЕНО" && \
echo -n "Nginx: " && nginx -v 2>&1 | head -1 || echo "НЕ ВСТАНОВЛЕНО" && \
echo -n "PM2: " && pm2 --version 2>/dev/null || echo "НЕ ВСТАНОВЛЕНО" && \
echo -n "Git: " && git --version 2>/dev/null || echo "НЕ ВСТАНОВЛЕНО" && \
echo "=== Готово ==="
```

Якщо побачите **НЕ ВСТАНОВЛЕНО** — виконайте відповідні команди нижче.

---

### Встановлення Node.js (версія 20+)

```bash
# Додаємо офіційне джерело Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Встановлюємо Node.js
sudo apt-get install -y nodejs

# Перевіряємо
node --version   # має показати v20.x.x або вище
npm --version    # має показати 10.x.x або вище
```

---

### Встановлення PostgreSQL

```bash
# Встановлюємо PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Запускаємо і додаємо в автозапуск
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Перевіряємо
sudo systemctl status postgresql   # має бути "active (running)"
```

---

### Встановлення Nginx (веб-сервер)

```bash
# Встановлюємо Nginx
sudo apt-get install -y nginx

# Запускаємо і додаємо в автозапуск
sudo systemctl start nginx
sudo systemctl enable nginx

# Перевіряємо — відкрийте в браузері http://IP-вашого-сервера
# Має відображатись сторінка "Welcome to nginx"
```

---

### Встановлення PM2 (менеджер процесів)

```bash
# Встановлюємо PM2 глобально
sudo npm install -g pm2

# Перевіряємо
pm2 --version
```

---

### Встановлення Git

```bash
sudo apt-get install -y git

# Перевіряємо
git --version
```

---

## 🗄️ КРОК 1: Налаштування бази даних (PostgreSQL)

База даних — це місце де зберігаються всі товари, замовлення, клієнти.

### 1.1 Створюємо користувача та базу даних

```bash
# Переходимо в режим адміністратора PostgreSQL
sudo -u postgres psql
```

Ви потрапите в середовище PostgreSQL (рядок зміниться на `postgres=#`).
Введіть ці команди **по одній**, після кожної натискайте Enter:

```sql
-- Створюємо користувача (замініть ПАРОЛЬ на свій складний пароль)
CREATE USER store_user WITH PASSWORD 'ПАРОЛЬ';

-- Створюємо базу даних
CREATE DATABASE tel_bot_store OWNER store_user;

-- Надаємо всі права
GRANT ALL PRIVILEGES ON DATABASE tel_bot_store TO store_user;

-- Виходимо
\q
```

### 1.2 Запам'ятайте ці дані — вони знадобляться для .env:
- **Користувач:** `store_user`
- **Пароль:** той що ви вказали
- **База даних:** `tel_bot_store`

---

## 🌐 КРОК 2: Налаштування домену та HTTPS

### 2.1 Вказуємо домен на сервер

У панелі вашого реєстратора домену (наприклад nic.ua, namecheap.com):
1. Перейдіть в **DNS-налаштування** вашого домену
2. Додайте або змініть **A-запис**:
   - **Ім'я:** `@` (або залиште порожнім — означає кореневий домен)
   - **Значення (IP):** IP-адреса вашого сервера
   - **TTL:** 300 (або залиште за замовчуванням)
3. Збережіть. Зміни DNS застосовуються від 5 хвилин до 24 годин.

### 2.2 Налаштовуємо Nginx

Створюємо конфігурацію для вашого домену:

```bash
# Відкриваємо редактор (замініть ВАШ-ДОМЕН.com на свій домен)
sudo nano /etc/nginx/sites-available/store
```

Вставте цей текст (замініть `ВАШ-ДОМЕН.com` та порт `4000` якщо змінювали):

```nginx
server {
    listen 80;
    server_name ВАШ-ДОМЕН.com www.ВАШ-ДОМЕН.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Зберегти: `Ctrl+O` → Enter → вийти: `Ctrl+X`

```bash
# Активуємо конфігурацію
sudo ln -s /etc/nginx/sites-available/store /etc/nginx/sites-enabled/

# Перевіряємо чи немає помилок
sudo nginx -t

# Перезапускаємо Nginx
sudo systemctl reload nginx
```

### 2.3 Встановлюємо безкоштовний SSL (HTTPS)

```bash
# Встановлюємо Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Отримуємо сертифікат (замініть домен)
sudo certbot --nginx -d ВАШ-ДОМЕН.com -d www.ВАШ-ДОМЕН.com

# Слідуйте інструкціям: введіть email, погодьтесь з умовами
# Certbot сам оновить конфігурацію Nginx для HTTPS

# Перевіряємо — відкрийте https://ВАШ-ДОМЕН.com в браузері
```

---

## 📁 КРОК 3: Завантаження проекту на сервер

```bash
# Переходимо в домашню папку
cd ~

# Створюємо папку для проектів
mkdir -p projects

# Переходимо в папку
cd projects

# Завантажуємо проект з GitHub
git clone https://github.com/Valco/Telegram-store-app.git store

# Переходимо в папку проекту
cd store
```

---

## ⚙️ КРОК 4: Налаштування змінних середовища (.env)

Файл `.env` — це секретний файл з паролями та ключами. Він не завантажується на GitHub, тому його потрібно створити вручну.

```bash
# Створюємо файл .env
nano .env
```

Вставте весь текст нижче і заповніть кожне поле своїми даними:

```env
# ============================
# БАЗА ДАНИХ
# ============================
DATABASE_URL="postgresql://store_user:ПАРОЛЬ@localhost:5432/tel_bot_store?schema=public"
# Замініть ПАРОЛЬ на пароль користувача БД з Кроку 1

# ============================
# БЕЗПЕКА
# ============================
JWT_SECRET_KEY="введіть-довгий-випадковий-рядок-мінімум-32-символи"
# Придумайте складний рядок, наприклад: xK9#mP2$qR7nL4wE8vT1

# ============================
# АДРЕСА САЙТУ
# ============================
NEXT_PUBLIC_BASE_URL="https://ВАШ-ДОМЕН.com"
# Замініть на ваш реальний домен з https://

# ============================
# TELEGRAM BOT ⚡ ОБОВ'ЯЗКОВО
# ============================
TELEGRAM_BOT_TOKEN="токен-від-BotFather"
# Отримати: t.me/BotFather → /newbot

# ============================
# MONOBANK ⚡ ОБОВ'ЯЗКОВО
# ============================
MONOBANK_API_KEY="ваш-токен-monobank"

# ============================
# НОВА ПОШТА ⚡ ОБОВ'ЯЗКОВО
# ============================
NOVA_POSHTA_API_KEY="ваш-api-ключ-нової-пошти"

# ============================
# EMAIL (SMTP) ⚡ ОБОВ'ЯЗКОВО
# ============================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="ваш-gmail@gmail.com"
SMTP_PASS="пароль-застосунку-google"
SMTP_ADMIN_EMAIL="ваш-gmail@gmail.com"
SMTP_FROM_EMAIL="ваш-gmail@gmail.com"

# ============================
# AI — ANTHROPIC CLAUDE (опціонально)
# ============================
ANTHROPIC_API_KEY=""
# Отримати: console.anthropic.com

# ============================
# AI — PHOTOROOM (опціонально)
# ============================
PHOTOROOM_SANDBOX_KEY=""
PHOTOROOM_LIVE_KEY=""
PHOTOROOM_ENVIRONMENT="sandbox"
# Змініть на "live" коли перейдете на реальний ключ

# ============================
# СХОВИЩЕ — AMAZON S3 (опціонально)
# ============================
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_BUCKET_NAME=""
AWS_REGION=""

# ============================
# ФІСКАЛІЗАЦІЯ — CHECKBOX (опціонально)
# ============================
CHECKBOX_LICENSE_KEY=""

# ============================
# НАЛАШТУВАННЯ ДЕПЛОЮ
# ============================
DEPLOY_USER="root"
DEPLOY_HOST="IP-або-ДОМЕН-сервера"
DEPLOY_PORT="22"
DEPLOY_PROJECT_DIR="~/projects/store"
DEPLOY_PM2_NAME="store-app"
DEPLOY_NEXTJS_PORT="4000"
```

Зберегти: `Ctrl+O` → Enter → вийти: `Ctrl+X`

---

## 📦 КРОК 5: Встановлення залежностей та збірка

```bash
# Встановлюємо всі пакети проекту (займе 1-3 хвилини)
npm install

# Застосовуємо структуру бази даних
npx prisma db push

# Заповнюємо базу початковими даними (категорії, адмін-акаунт)
npx prisma db seed

# Збираємо проект для продакшну (займе 2-5 хвилин)
npm run build
```

> ⚠️ Якщо на етапі `npm run build` з'явились помилки — перевірте що всі обов'язкові поля в `.env` заповнені.

---

## 👤 КРОК 6: Перший адміністратор

Команда `npx prisma db seed` з Кроку 5 вже автоматично створила:
- ✅ Групи доступу (Суперадмін, Адмін, Менеджер, Глядач)
- ✅ Тестовий адмін-акаунт

**Дані для першого входу:**
- Email: `admin@tel.bot`
- Пароль: `test111`
- OTP: вимкнений

> ⚠️ **Обов'язково змініть пароль після першого входу** в розділі «Персонал (Ролі)» → ваш акаунт → «Змінити пароль».

**Якщо потрібно перестворити адміна вручну:**
```bash
npx prisma db seed
```

---

## 🚀 КРОК 7: Запуск застосунку

```bash
# Запускаємо через PM2 (він слідкує щоб застосунок завжди працював)
pm2 start npm --name "store-app" -- start

# Додаємо в автозапуск при перезавантаженні сервера
pm2 startup
# Скопіюйте та виконайте команду яку виведе PM2

pm2 save

# Перевіряємо що застосунок запущено
pm2 status
# Має бути "online" зеленим кольором
```

---

## 🔗 КРОК 8: Налаштування Telegram Webhook

Webhook — це адреса, на яку Telegram надсилає повідомлення від покупців.

```bash
# Виконайте цю команду (замініть ТОКЕН і ДОМЕН)
curl "https://api.telegram.org/botТОКЕН/setWebhook?url=https://ВАШ-ДОМЕН.com/api/telegram/webhook"

# Повинні побачити відповідь:
# {"ok":true,"result":true,"description":"Webhook was set"}
```

---

## ✅ КРОК 9: Фінальна перевірка

```bash
# Перевіряємо стан застосунку
pm2 logs store-app --lines 20

# Перевіряємо базу даних
pm2 status
```

Відкрийте в браузері:
- **Магазин:** `https://ВАШ-ДОМЕН.com` — має відображатись каталог товарів
- **Адмінка:** `https://ВАШ-ДОМЕН.com/admin` — має відображатись форма входу

---

## 🔄 Оновлення проекту (після змін на GitHub)

```bash
cd ~/projects/store

# Завантажуємо зміни
git pull

# Встановлюємо нові пакети (якщо додались)
npm install

# Застосовуємо зміни в базі даних (якщо були)
npx prisma db push

# Перебудовуємо
npm run build

# Перезапускаємо
pm2 restart store-app
```

---

## 🆘 Часті проблеми

| Проблема | Рішення |
|---|---|
| Сайт не відкривається | Перевірте `pm2 status` — застосунок має бути `online` |
| Помилка 502 Bad Gateway | Перевірте чи застосунок запущено: `pm2 logs store-app` |
| Помилка підключення до БД | Перевірте `DATABASE_URL` в `.env` — логін/пароль/назва БД |
| Не приходить email | Перевірте `SMTP_USER` і `SMTP_PASS` — пароль має бути від **застосунку** Google, не від акаунту |
| Telegram бот не відповідає | Перевірте webhook: `curl https://api.telegram.org/botТОКЕН/getWebhookInfo` |

---

## 📋 Швидкий старт (всі команди разом)

Для досвідчених користувачів — всі команди встановлення по порядку:

```bash
# 1. Оновлення системи
sudo apt-get update && sudo apt-get upgrade -y

# 2. Встановлення необхідного
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib nginx certbot python3-certbot-nginx git
sudo npm install -g pm2

# 3. Налаштування PostgreSQL
sudo -u postgres psql -c "CREATE USER store_user WITH PASSWORD 'ПАРОЛЬ';"
sudo -u postgres psql -c "CREATE DATABASE tel_bot_store OWNER store_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tel_bot_store TO store_user;"

# 4. Завантаження проекту
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/Valco/Telegram-store-app.git store
cd store

# 5. Налаштування .env
nano .env   # заповніть всі поля

# 6. Встановлення, збірка та seed
npm install && npx prisma db push && npx prisma db seed && npm run build

# 7. Запуск
pm2 start npm --name "store-app" -- start && pm2 startup && pm2 save

# 8. Webhook
curl "https://api.telegram.org/botТОКЕН/setWebhook?url=https://ВАШ-ДОМЕН.com/api/telegram/webhook"
```
