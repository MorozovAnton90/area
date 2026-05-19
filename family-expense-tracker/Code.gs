// ============================================================
// Code.gs — главный файл. Обработка webhook от Telegram.
// ============================================================
// Как это работает:
//   1. Telegram присылает POST-запрос на URL вашего Apps Script
//   2. doPost() получает запрос и разбирает его
//   3. Если это текст — парсим как расход
//   4. Если это нажатие кнопки — обрабатываем callback
// ============================================================

// !! ОБЯЗАТЕЛЬНО ЗАПОЛНИТЕ ЭТИ ЗНАЧЕНИЯ !!
var BOT_TOKEN = "";        // Токен от BotFather, например: "1234567890:ABCdef..."
var ALLOWED_CHAT_IDS = []; // ID чатов/пользователей, которым разрешён доступ
                           // Например: [123456789, 987654321]
                           // Оставьте пустым [] чтобы разрешить всем (не рекомендуется)

// URL Telegram API
var TG_API = "https://api.telegram.org/bot" + BOT_TOKEN;

// ============================================================
// Точка входа — вызывается при каждом запросе от Telegram
// ============================================================
function doPost(e) {
  try {
    var update = JSON.parse(e.postData.contents);
    processUpdate(update);
  } catch (err) {
    Logger.log("Ошибка doPost: " + err.toString());
  }
  // Всегда возвращаем 200 OK, иначе Telegram будет слать повторно
  return ContentService.createTextOutput("OK");
}

// Обработка входящего обновления от Telegram
function processUpdate(update) {
  // Нажатие inline-кнопки
  if (update.callback_query) {
    handleCallbackQuery(update.callback_query);
    return;
  }

  // Текстовое сообщение
  if (update.message && update.message.text) {
    handleMessage(update.message);
    return;
  }
}

// ============================================================
// Обработка текстовых сообщений
// ============================================================
function handleMessage(message) {
  var chatId = message.chat.id;
  var text = message.text.trim();
  var messageId = message.message_id;
  var author = message.from.first_name || message.from.username || "Неизвестный";

  // Проверяем доступ
  if (ALLOWED_CHAT_IDS.length > 0 && ALLOWED_CHAT_IDS.indexOf(chatId) === -1) {
    sendMessage(chatId, "Нет доступа.");
    return;
  }

  // Обработка команд
  if (text === "/start" || text === "/help") {
    handleHelp(chatId);
    return;
  }
  if (text === "/today") {
    handleToday(chatId);
    return;
  }
  if (text === "/month") {
    handleMonth(chatId);
    return;
  }
  if (text === "/top") {
    handleTop(chatId);
    return;
  }
  if (text === "/uncategorized") {
    handleUncategorized(chatId);
    return;
  }

  // Если не команда — пробуем распарсить как расход
  var parsed = parseMessage(text);

  if (!parsed || !parsed.amount) {
    sendMessage(chatId, "Не понял сообщение 🤔\n\nНапишите сумму и комментарий, например:\n• 1840 пятерочка\n• медицина 2500 линзы\n• еда 350 обед\n\nИли используйте /help для списка команд.");
    return;
  }

  // Сохраняем расход
  var recordId = saveExpense({
    amount: parsed.amount,
    category: parsed.category,
    comment: parsed.comment,
    author: author,
    raw: text,
    messageId: messageId,
    chatId: chatId
  });

  // Если категория не определена — предлагаем выбрать
  if (!parsed.category) {
    sendCategorySelector(chatId, recordId, parsed.amount, parsed.comment);
    return;
  }

  // Всё хорошо — отвечаем с кнопками "Изменить категорию" и "Удалить"
  sendSuccessMessage(chatId, recordId, parsed.amount, parsed.category, parsed.comment);
}

// ============================================================
// Обработка нажатия inline-кнопок
// ============================================================
function handleCallbackQuery(query) {
  var chatId = query.message.chat.id;
  var messageId = query.message.message_id;
  var data = query.data;
  var queryId = query.id;

  // Подтверждаем нажатие (убираем "часики" на кнопке)
  answerCallbackQuery(queryId);

  // Формат callback_data:
  //   "cat|RECORD_ID|CATEGORY"   — выбор категории
  //   "change|RECORD_ID"         — изменить категорию
  //   "delete|RECORD_ID"         — удалить запись

  var parts = data.split("|");
  var action = parts[0];
  var recordId = parts[1];

  if (action === "cat") {
    // Пользователь выбрал категорию
    var newCategory = parts.slice(2).join("|"); // Категория может содержать |
    var success = updateCategory(recordId, newCategory);
    if (success) {
      editMessage(chatId, messageId, "✅ Категория обновлена: *" + newCategory + "*");
    } else {
      editMessage(chatId, messageId, "Не нашёл запись для обновления.");
    }

  } else if (action === "change") {
    // Показываем кнопки выбора категории заново
    editMessageWithCategories(chatId, messageId, recordId);

  } else if (action === "delete") {
    // Удаляем запись
    var deleted = deleteExpense(recordId);
    if (deleted) {
      editMessage(chatId, messageId, "🗑 Запись удалена.");
    } else {
      editMessage(chatId, messageId, "Не нашёл запись для удаления.");
    }
  }
}

// ============================================================
// Отправка сообщений и управление клавиатурой
// ============================================================

// Справка по боту
function handleHelp(chatId) {
  var text = "👋 *Семейный трекер расходов*\n\n" +
    "Просто напишите сумму и комментарий:\n" +
    "• `1840 пятерочка`\n" +
    "• `медицина 2500 линзы`\n" +
    "• `еда 3200 доставка`\n\n" +
    "*Команды:*\n" +
    "/today — расходы за сегодня\n" +
    "/month — расходы за месяц по категориям\n" +
    "/top — топ крупных трат месяца\n" +
    "/uncategorized — траты без категории";
  sendMessage(chatId, text);
}

// Успешное сохранение с кнопками "Изменить категорию" и "Удалить"
function sendSuccessMessage(chatId, recordId, amount, category, comment) {
  var text = "✅ Записал:\n" +
    "💰 *" + formatAmount(amount) + " ₽*\n" +
    "📂 " + category + "\n" +
    (comment ? "💬 " + comment : "");

  var keyboard = {
    inline_keyboard: [
      [
        { text: "✏️ Изменить категорию", callback_data: "change|" + recordId },
        { text: "🗑 Удалить", callback_data: "delete|" + recordId }
      ]
    ]
  };

  sendMessageWithKeyboard(chatId, text, keyboard);
}

// Предложить выбрать категорию (если не определена автоматически)
function sendCategorySelector(chatId, recordId, amount, comment) {
  var text = "❓ Не определил категорию для:\n" +
    "💰 *" + formatAmount(amount) + " ₽*" +
    (comment ? " — " + comment : "") +
    "\n\nВыберите категорию:";

  var keyboard = buildCategoryKeyboard(recordId);
  sendMessageWithKeyboard(chatId, text, keyboard);
}

// Редактировать сообщение, показав выбор категорий
function editMessageWithCategories(chatId, messageId, recordId) {
  var text = "Выберите новую категорию:";
  var keyboard = buildCategoryKeyboard(recordId);
  editMessageWithKeyboard(chatId, messageId, text, keyboard);
}

// Построить клавиатуру с категориями (по 2 в ряду)
function buildCategoryKeyboard(recordId) {
  var categories = getCategoryList();
  var rows = [];
  for (var i = 0; i < categories.length; i += 2) {
    var row = [];
    row.push({ text: categories[i], callback_data: "cat|" + recordId + "|" + categories[i] });
    if (i + 1 < categories.length) {
      row.push({ text: categories[i + 1], callback_data: "cat|" + recordId + "|" + categories[i + 1] });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

// ============================================================
// Низкоуровневые функции Telegram API
// ============================================================

// Отправить простое текстовое сообщение
function sendMessage(chatId, text) {
  var url = TG_API + "/sendMessage";
  var payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown"
  };
  callTelegramApi(url, payload);
}

// Отправить сообщение с inline-клавиатурой
function sendMessageWithKeyboard(chatId, text, keyboard) {
  var url = TG_API + "/sendMessage";
  var payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify(keyboard)
  };
  callTelegramApi(url, payload);
}

// Отредактировать существующее сообщение (заменить текст)
function editMessage(chatId, messageId, text) {
  var url = TG_API + "/editMessageText";
  var payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: "Markdown"
  };
  callTelegramApi(url, payload);
}

// Отредактировать сообщение с новой клавиатурой
function editMessageWithKeyboard(chatId, messageId, text, keyboard) {
  var url = TG_API + "/editMessageText";
  var payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify(keyboard)
  };
  callTelegramApi(url, payload);
}

// Подтвердить нажатие кнопки (убирает индикатор загрузки)
function answerCallbackQuery(queryId) {
  var url = TG_API + "/answerCallbackQuery";
  var payload = { callback_query_id: queryId };
  callTelegramApi(url, payload);
}

// Базовый вызов Telegram API через HTTP POST
function callTelegramApi(url, payload) {
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    if (!result.ok) {
      Logger.log("Telegram API error: " + JSON.stringify(result));
    }
    return result;
  } catch (err) {
    Logger.log("callTelegramApi error: " + err.toString());
    return null;
  }
}

// ============================================================
// Настройка webhook — запустите эту функцию ОДИН РАЗ вручную
// ============================================================
function setWebhook() {
  var scriptUrl = ScriptApp.getService().getUrl();
  var url = TG_API + "/setWebhook?url=" + scriptUrl;
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

// Проверить текущий webhook
function getWebhookInfo() {
  var url = TG_API + "/getWebhookInfo";
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}
