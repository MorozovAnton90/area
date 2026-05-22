// ============================================================
// Code.gs — главный файл. Polling-режим (без webhook).
// ============================================================
// Как это работает:
//   1. Триггер каждую минуту вызывает pollUpdates()
//   2. pollUpdates() запрашивает новые сообщения у Telegram
//   3. Каждое сообщение обрабатывается: парсинг → запись в таблицу
//   4. Нажатия кнопок тоже обрабатываются
// ============================================================

// !! ОБЯЗАТЕЛЬНО ЗАПОЛНИТЕ ЭТИ ЗНАЧЕНИЯ !!
var BOT_TOKEN = "";        // Токен от BotFather
var ALLOWED_CHAT_IDS = []; // ID пользователей с доступом, например: [123456789, 987654321]

// URL Telegram API
var TG_API = "https://api.telegram.org/bot" + BOT_TOKEN;

// ============================================================
// Главная функция — вызывается триггером каждую минуту
// ============================================================
function pollUpdates() {
  var props = PropertiesService.getScriptProperties();
  var lastUpdateId = Number(props.getProperty("lastUpdateId") || 0);

  var url = TG_API + "/getUpdates?offset=" + (lastUpdateId + 1) + "&limit=100&timeout=0";
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var data = JSON.parse(response.getContentText());

  if (!data.ok || data.result.length === 0) return;

  for (var i = 0; i < data.result.length; i++) {
    try {
      processUpdate(data.result[i]);
    } catch (err) {
      Logger.log("Ошибка при обработке update: " + err.toString());
    }
    lastUpdateId = data.result[i].update_id;
  }

  props.setProperty("lastUpdateId", String(lastUpdateId));
}

// ============================================================
// Обработка одного обновления от Telegram
// ============================================================
function processUpdate(update) {
  if (update.callback_query) {
    handleCallbackQuery(update.callback_query);
    return;
  }
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

  // Парсим как расход
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

  // Отвечаем с кнопками
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

  answerCallbackQuery(queryId);

  var parts = data.split("|");
  var action = parts[0];
  var recordId = parts[1];

  if (action === "cat") {
    var newCategory = parts.slice(2).join("|");
    var success = updateCategory(recordId, newCategory);
    if (success) {
      editMessage(chatId, messageId, "✅ Категория обновлена: *" + newCategory + "*");
    } else {
      editMessage(chatId, messageId, "Не нашёл запись для обновления.");
    }

  } else if (action === "change") {
    editMessageWithCategories(chatId, messageId, recordId);

  } else if (action === "delete") {
    var deleted = deleteExpense(recordId);
    if (deleted) {
      editMessage(chatId, messageId, "🗑 Запись удалена.");
    } else {
      editMessage(chatId, messageId, "Не нашёл запись для удаления.");
    }
  }
}

// ============================================================
// Сообщения и клавиатуры
// ============================================================

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

function sendSuccessMessage(chatId, recordId, amount, category, comment) {
  var text = "✅ Записал:\n" +
    "💰 *" + formatAmount(amount) + " ₽*\n" +
    "📂 " + category + "\n" +
    (comment ? "💬 " + escapeMd(comment) : "");

  var keyboard = {
    inline_keyboard: [[
      { text: "✏️ Изменить категорию", callback_data: "change|" + recordId },
      { text: "🗑 Удалить", callback_data: "delete|" + recordId }
    ]]
  };
  sendMessageWithKeyboard(chatId, text, keyboard);
}

function sendCategorySelector(chatId, recordId, amount, comment) {
  var text = "❓ Не определил категорию для:\n" +
    "💰 *" + formatAmount(amount) + " ₽*" +
    (comment ? " — " + escapeMd(comment) : "") +
    "\n\nВыберите категорию:";
  sendMessageWithKeyboard(chatId, text, buildCategoryKeyboard(recordId));
}

function editMessageWithCategories(chatId, messageId, recordId) {
  editMessageWithKeyboard(chatId, messageId, "Выберите новую категорию:", buildCategoryKeyboard(recordId));
}

function buildCategoryKeyboard(recordId) {
  var categories = getCategoryList();
  var rows = [];
  for (var i = 0; i < categories.length; i += 2) {
    var row = [{ text: categories[i], callback_data: "cat|" + recordId + "|" + categories[i] }];
    if (i + 1 < categories.length) {
      row.push({ text: categories[i + 1], callback_data: "cat|" + recordId + "|" + categories[i + 1] });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

// ============================================================
// Telegram API
// ============================================================

function escapeMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*`\[]/g, function(c) { return "\\" + c; });
}

function sendMessage(chatId, text) {
  var safeText = text.length > 4000 ? text.substring(0, 4000) + "\n\n_(обрезано)_" : text;
  callTelegramApi(TG_API + "/sendMessage", {
    chat_id: chatId,
    text: safeText,
    parse_mode: "Markdown"
  });
}

function sendMessageWithKeyboard(chatId, text, keyboard) {
  callTelegramApi(TG_API + "/sendMessage", {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify(keyboard)
  });
}

function editMessage(chatId, messageId, text) {
  callTelegramApi(TG_API + "/editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: "Markdown"
  });
}

function editMessageWithKeyboard(chatId, messageId, text, keyboard) {
  callTelegramApi(TG_API + "/editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify(keyboard)
  });
}

function answerCallbackQuery(queryId) {
  callTelegramApi(TG_API + "/answerCallbackQuery", { callback_query_id: queryId });
}

function callTelegramApi(url, payload) {
  try {
    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var result = JSON.parse(response.getContentText());
    if (!result.ok) Logger.log("Telegram API error: " + JSON.stringify(result));
    return result;
  } catch (err) {
    Logger.log("callTelegramApi error: " + err.toString());
    return null;
  }
}

// ============================================================
// Настройка триггера — запустите ОДИН РАЗ вручную
// ============================================================
function setupTrigger() {
  // Удаляем старые триггеры если есть
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "pollUpdates") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Создаём новый триггер — каждую минуту
  ScriptApp.newTrigger("pollUpdates")
    .timeBased()
    .everyMinutes(1)
    .create();
  Logger.log("Триггер установлен: pollUpdates будет запускаться каждую минуту");
}

// Тестовая функция — проверить что бот получает сообщения
function testPoll() {
  var url = TG_API + "/getUpdates?limit=5&timeout=0";
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log(response.getContentText());
}
