// ============================================================
// Sheets.gs — работа с Google Sheets
// ============================================================
// Структура таблицы:
//   Лист "Расходы":
//     A: ID записи       (уникальный, для редактирования/удаления)
//     B: Дата            (дата и время)
//     C: Сумма           (число)
//     D: Категория       (текст)
//     E: Комментарий     (текст)
//     F: Автор           (имя пользователя Telegram)
//     G: Raw             (исходное сообщение)
//     H: Message ID      (ID сообщения Telegram, для редактирования ответа)
//     I: Chat ID         (ID чата)
// ============================================================

var SHEET_NAME = "Расходы";
var SPREADSHEET_ID = ""; // ← ВСТАВЬТЕ ID вашей таблицы сюда!

// Получить таблицу расходов
function getSheet() {
  var ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = createSheet(ss);
  }
  return sheet;
}

// Создать лист с заголовками, если его нет
function createSheet(ss) {
  var sheet = ss.insertSheet(SHEET_NAME);
  var headers = ["ID", "Дата", "Сумма", "Категория", "Комментарий", "Автор", "Исходное сообщение", "Message ID Telegram", "Chat ID"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

// Записать расход в таблицу
// Возвращает ID записанной строки
function saveExpense(data) {
  var sheet = getSheet();
  var id = generateId();
  var now = new Date();
  var row = [
    id,
    now,
    data.amount,
    data.category || "Непонятное",
    data.comment,
    data.author,
    data.raw,
    data.messageId || "",
    data.chatId || ""
  ];
  sheet.appendRow(row);
  return id;
}

// Обновить категорию у записи по ID
function updateCategory(recordId, newCategory) {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(recordId)) {
      sheet.getRange(i + 1, 4).setValue(newCategory); // Столбец D — Категория
      return true;
    }
  }
  return false;
}

// Удалить запись по ID
function deleteExpense(recordId) {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(recordId)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// Получить расходы за сегодня
function getTodayExpenses() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  var todayStr = formatDate(today);
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var rowDate = new Date(data[i][1]);
    if (formatDate(rowDate) === todayStr) {
      result.push({
        id: data[i][0],
        date: data[i][1],
        amount: data[i][2],
        category: data[i][3],
        comment: data[i][4],
        author: data[i][5]
      });
    }
  }
  return result;
}

// Получить расходы за текущий месяц
function getMonthExpenses() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  var currentMonth = today.getMonth();
  var currentYear = today.getFullYear();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var rowDate = new Date(data[i][1]);
    if (rowDate.getMonth() === currentMonth && rowDate.getFullYear() === currentYear) {
      result.push({
        id: data[i][0],
        date: data[i][1],
        amount: data[i][2],
        category: data[i][3],
        comment: data[i][4],
        author: data[i][5]
      });
    }
  }
  return result;
}

// Получить расходы без нормальной категории
function getUncategorizedExpenses() {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  var today = new Date();
  var currentMonth = today.getMonth();
  var currentYear = today.getFullYear();
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var rowDate = new Date(data[i][1]);
    if (rowDate.getMonth() === currentMonth && rowDate.getFullYear() === currentYear) {
      var category = data[i][3];
      if (!category || category === "Непонятное") {
        result.push({
          id: data[i][0],
          date: data[i][1],
          amount: data[i][2],
          category: data[i][3],
          comment: data[i][4],
          author: data[i][5]
        });
      }
    }
  }
  return result;
}

// Форматирование даты в строку YYYY-MM-DD
function formatDate(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

// Генерация уникального ID
function generateId() {
  return new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
}
