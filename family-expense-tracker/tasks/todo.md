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
- [x] Реализовать Parser.gs
- [x] Реализовать Sheets.gs
- [x] Реализовать Commands.gs
- [x] Реализовать Code.gs (main webhook)
- [x] Написать ИНСТРУКЦИЯ.md с пошаговым гайдом
- [x] Проверить логику парсинга
- [x] Веб-дашборд Dashboard.gs + dashboard.html
  - Glassmorphism UI, Pantone Summer палитра, тёмная/светлая тема
  - Пончик, столбчатый, линейный графики + топ трат
  - Фильтры по месяцу и автору, анимации, демо-режим
- [ ] Задеплоить Dashboard.gs как веб-приложение (Deploy → New deployment → Web App)

## Уроки
- Google Apps Script — это JavaScript на сервере Google, развёртывание через веб-редактор
- Webhook Telegram → Apps Script: нужен URL вида /exec (не /dev)
- Для кнопок Telegram используется inline_keyboard в reply_markup
- callback_query обрабатывается отдельно от message
