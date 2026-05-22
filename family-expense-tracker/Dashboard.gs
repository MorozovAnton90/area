// ============================================================
// Dashboard.gs — веб-дашборд расходов
// ============================================================
// Добавьте новое развёртывание (Deploy → New deployment → Web App)
// Или используйте существующее. doGet() служит HTML-страницу.
// ============================================================

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('dashboard')
    .setTitle('Дашборд расходов 💰')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Отдаёт все данные из таблицы расходов как JSON-строку
function getDashboardData() {
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return JSON.stringify({ success: true, data: [] });
    }

    // Определяем, есть ли заголовок (первая ячейка — текст, не число и не дата)
    var startRow = 1;
    if (data[0] && typeof data[0][0] === 'string' && isNaN(Number(data[0][0]))) {
      startRow = 1; // пропускаем строку заголовка
    } else {
      startRow = 0;
    }

    var records = [];
    var tz = Session.getScriptTimeZone();

    for (var i = startRow; i < data.length; i++) {
      var row = data[i];

      // Пропускаем пустые строки
      if (!row[0] || row[0] === '') continue;

      // Парсим дату
      var dateStr = null;
      if (row[1]) {
        try {
          var d = new Date(row[1]);
          if (!isNaN(d.getTime())) {
            dateStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
          }
        } catch (e) { /* пропускаем */ }
      }

      // Парсим сумму
      var amountRaw = String(row[2] || '').replace(/[^\d.,-]/g, '').replace(',', '.');
      var amount = parseFloat(amountRaw);

      if (!dateStr || isNaN(amount) || amount <= 0) continue;

      records.push({
        id: String(row[0]),
        date: dateStr,
        amount: Math.round(amount * 100) / 100,
        category: String(row[3] || 'Непонятное').trim(),
        comment: String(row[4] || '').trim(),
        author: String(row[5] || '').trim(),
        message: String(row[6] || '').trim()
      });
    }

    return JSON.stringify({ success: true, data: records });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}
