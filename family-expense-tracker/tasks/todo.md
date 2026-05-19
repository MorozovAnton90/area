# Семейный трекер расходов — план MVP

## Архитектура
- Telegram Bot (webhook) → Google Apps Script → Google Sheets
- Без серверов, без хостинга, бесплатно

## Файлы проекта
- `Code.gs` — главный файл Apps Script (webhook, парсинг, запись)
- `Sheets.gs` — работа с Google Sheets (чтение/запись)
- `Parser.gs` — парсинг сообщений пользователя
- `Commands.gs` — команды /today, /month, /top, /uncategorized
- `README.md` — пошаговая инструкция

## Шаги

- [x] Создать ветку
- [x] Написать план
- [ ] Реализовать Parser.gs
- [ ] Реализовать Sheets.gs
- [ ] Реализовать Commands.gs
- [ ] Реализовать Code.gs (main webhook)
- [ ] Написать README с инструкцией
- [ ] Проверить логику парсинга
- [ ] Финальный коммит и push

## Уроки
- Google Apps Script — это JavaScript на сервере Google, развёртывание через веб-редактор
- Webhook Telegram → Apps Script: нужен URL вида /exec (не /dev)
- Для кнопок Telegram используется inline_keyboard в reply_markup
- callback_query обрабатывается отдельно от message
