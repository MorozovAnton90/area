// ============================================================
// Commands.gs — обработка команд /today, /month, /top, /uncategorized
// ============================================================

// /today — расходы за сегодня
function handleToday(chatId) {
  var expenses = getTodayExpenses();

  if (expenses.length === 0) {
    sendMessage(chatId, "Сегодня трат не записано 🎉");
    return;
  }

  var total = 0;
  var lines = ["📅 *Расходы за сегодня:*\n"];

  for (var i = 0; i < expenses.length; i++) {
    var e = expenses[i];
    total += Number(e.amount);
    var line = "• " + formatAmount(e.amount) + " ₽ — " + (e.category || "?") + " (" + (e.comment || "—") + ") [" + e.author + "]";
    lines.push(line);
  }

  lines.push("\n💰 *Итого: " + formatAmount(total) + " ₽*");
  sendMessage(chatId, lines.join("\n"));
}

// /month — расходы за месяц по категориям
function handleMonth(chatId) {
  var expenses = getMonthExpenses();

  if (expenses.length === 0) {
    sendMessage(chatId, "В этом месяце трат не записано.");
    return;
  }

  // Группируем по категориям
  var byCategory = {};
  var total = 0;
  for (var i = 0; i < expenses.length; i++) {
    var e = expenses[i];
    var cat = e.category || "Непонятное";
    if (!byCategory[cat]) byCategory[cat] = 0;
    byCategory[cat] += Number(e.amount);
    total += Number(e.amount);
  }

  // Сортируем по убыванию суммы
  var sorted = Object.keys(byCategory).sort(function(a, b) {
    return byCategory[b] - byCategory[a];
  });

  var monthName = getMonthName(new Date());
  var lines = ["📊 *Расходы за " + monthName + ":*\n"];

  for (var j = 0; j < sorted.length; j++) {
    var cat = sorted[j];
    var percent = Math.round((byCategory[cat] / total) * 100);
    lines.push("• " + cat + ": *" + formatAmount(byCategory[cat]) + " ₽* (" + percent + "%)");
  }

  lines.push("\n💰 *Итого: " + formatAmount(total) + " ₽*");
  sendMessage(chatId, lines.join("\n"));
}

// /top — топ-10 крупных трат месяца
function handleTop(chatId) {
  var expenses = getMonthExpenses();

  if (expenses.length === 0) {
    sendMessage(chatId, "В этом месяце трат не записано.");
    return;
  }

  // Сортируем по убыванию суммы
  expenses.sort(function(a, b) {
    return Number(b.amount) - Number(a.amount);
  });

  var top = expenses.slice(0, 10);
  var lines = ["🏆 *Топ крупных трат месяца:*\n"];

  for (var i = 0; i < top.length; i++) {
    var e = top[i];
    var dateStr = formatDateShort(new Date(e.date));
    lines.push((i + 1) + ". " + formatAmount(e.amount) + " ₽ — " + (e.category || "?") + " (" + (e.comment || "—") + ") " + dateStr);
  }

  sendMessage(chatId, lines.join("\n"));
}

// /uncategorized — траты без нормальной категории
function handleUncategorized(chatId) {
  var expenses = getUncategorizedExpenses();

  if (expenses.length === 0) {
    sendMessage(chatId, "Все траты этого месяца разнесены по категориям ✅");
    return;
  }

  var lines = ["❓ *Траты без категории в этом месяце:*\n"];
  for (var i = 0; i < expenses.length; i++) {
    var e = expenses[i];
    var dateStr = formatDateShort(new Date(e.date));
    lines.push("• " + formatAmount(e.amount) + " ₽ — " + (e.comment || "—") + " " + dateStr);
  }

  sendMessage(chatId, lines.join("\n"));
}

// /categories — описание всех категорий
function handleCategories(chatId) {
  var descriptions = {
    "Продукты": "Супермаркеты, магазины, доставка продуктов (Пятёрочка, Магнит, Самокат, СберМаркет и т.д.)",
    "Кафе и рестораны": "Кафе, рестораны, фастфуд, кофейни, доставка готовой еды (Яндекс Еда, Delivery Club)",
    "Дом и быт": "Всё для дома: бытовая химия, посуда, мебель, декор, ремонт (Леруа Мерлен, ИКЕА, ОБИ)",
    "Мирон — развитие": "Всё для Мирона: игрушки, книги, секции, кружки, садик, LEGO, пазлы, настолки",
    "Одежда и обувь": "Покупка одежды и обуви для всей семьи (Zara, H&M, Uniqlo, Lamoda и др.)",
    "Ипотека и обязательные платежи": "Ипотека, коммуналка, ЖКХ, интернет, мобильная связь, электричество, страховки, налоги",
    "Рассрочки и кредиты": "Ежемесячные взносы по рассрочкам и кредитам",
    "Транспорт": "Такси, метро, электрички, авиа, бензин, парковка, каршеринг (Делимобиль, СитиДрайв)",
    "Красота и уход": "Салоны красоты, маникюр, стрижки, барбершоп, косметика, эпиляция, СПА",
    "Медицина": "Врачи, аптеки, лекарства, анализы, клиники, стоматолог, линзы, психолог",
    "Подарки": "Подарки, цветы, сувениры на праздники и дни рождения",
    "Питание на работе": "Столовая, бизнес-ланчи, обеды на работе",
    "Подписки": "Цифровые подписки: ChatGPT, Spotify, Netflix, Яндекс Плюс, Кинопоиск, Notion, Claude и др.",
    "Непонятное": "Траты, которые не попали ни в одну категорию — потом можно разобрать через /uncategorized"
  };

  var lines = ["📂 *Категории расходов:*\n"];
  var categories = getCategoryList();
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var desc = descriptions[cat] || "";
    lines.push("*" + cat + "*\n" + desc + "\n");
  }
  sendMessage(chatId, lines.join("\n"));
}

// Форматирование числа с пробелами (1234567 → 1 234 567)
function formatAmount(num) {
  return Number(num).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Короткая дата (напр. "19 мая")
function formatDateShort(date) {
  var months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return date.getDate() + " " + months[date.getMonth()];
}

// Полное название месяца (напр. "май 2026")
function getMonthName(date) {
  var months = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
  return months[date.getMonth()] + " " + date.getFullYear();
}
