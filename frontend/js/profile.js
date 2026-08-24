// profile.js — профиль и прогресс ученика в localStorage.
// Общий помощник: анкету заполняют на login.html, а показывают её на
// других экранах. Профиля может не быть — жюри способно открыть любую
// страницу по прямой ссылке, и это не должно ничего ломать.
// Здесь же живут очки и закрытые темы (readProgress / saveProgress внизу):
// их пишет экран темы, читает кабинет, а начальное значение кладёт вход.
// И итог диагностики (readDiagnostic / saveDiagnostic): его пишет api.js,
// когда диагностика закончилась. Одна реализация на все экраны.

// Профиль или null. null значит «профиля нет»: не заполняли, запись битая
// или localStorage недоступен (приватный режим). Наружу ошибки не выходят.
function readProfile() {
  try {
    const raw = localStorage.getItem("sabaqtas-profile");
    if (!raw) {
      return null;
    }
    const profile = JSON.parse(raw);
    // JSON.parse может вернуть что угодно («null», число, строку) —
    // профилем считаем только объект.
    return profile && typeof profile === "object" ? profile : null;
  } catch (error) {
    return null;
  }
}

// Код цели из анкеты -> человеческий текст. Неизвестный код — пустая строка.
function goalLabel(goal) {
  // Те же ключи, что и у вариантов в анкете: подпись цели должна
  // совпадать с тем, что ученик выбрал в списке.
  if (goal === "gaps") return t("goal.gaps", "Закрыть пробелы за прошлые годы");
  if (goal === "current") return t("goal.current", "Подтянуть текущую тему");
  if (goal === "ent") return t("goal.ent", "Подготовка к ЕНТ");
  if (goal === "olympiad") return t("goal.olympiad", "Подготовка к олимпиаде");
  return "";
}

// Одно предложение о том, как выбранная цель связана с планом «снизу вверх».
// Неизвестный код — пустая строка, и строка на экране просто не показывается.
function goalNote(goal) {
  if (goal === "ent") return t("goalNote.ent", "Тесты ЕНТ проверяют старшие классы, но ошибки чаще идут от пробелов ниже. Поэтому план начинается снизу.");
  if (goal === "gaps") return t("goalNote.gaps", "Именно для этого план и построен снизу вверх — от корневого пробела, а не от текущей темы.");
  if (goal === "current") return t("goalNote.current", "Текущую тему разберём, когда закроем то, на чём она стоит.");
  if (goal === "olympiad") return t("goalNote.olympiad", "Олимпиадные задачи стоят на школьной базе. Сначала убедимся, что в ней нет дыр.");
  return "";
}

// Код уровня подготовки из анкеты -> человеческий текст. Неизвестный код —
// пустая строка. Профили, сохранённые до появления этого поля, уровня не
// имеют: там придёт undefined, и строка на экране просто не показывается.
function levelLabel(level) {
  if (level === "weak") return t("level.weak", "Многое забыл");
  if (level === "medium") return t("level.medium", "Средний");
  if (level === "strong") return t("level.strong", "Уверенно себя чувствую");
  return "";
}

// Сколько целых дней осталось до даты из анкеты ("YYYY-MM-DD").
// null — когда даты нет, строка не разбирается или дата уже прошла:
// во всех трёх случаях показывать обратный отсчёт нечего.
// Сравниваем только даты, без времени: обе собираем из года, месяца и числа
// на полночь. Иначе «сегодня» давало бы 0 или −1 в зависимости от часа.
function daysUntil(dateString) {
  if (typeof dateString !== "string" || dateString === "") {
    return null;
  }

  const parts = dateString.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1; // месяцы в Date считаются с нуля
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const target = new Date(year, month, day);
  // Date молча «чинит» несуществующие даты (31 февраля -> 3 марта).
  // Если после сборки что-то изменилось, строка была битой.
  if (target.getFullYear() !== year || target.getMonth() !== month || target.getDate() !== day) {
    return null;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Округляем, а не делим нацело: в день перевода часов в сутках 23 или 25 часов.
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round((target - today) / dayMs);
  if (days < 0) {
    return null;
  }
  return days;
}

// --- Прогресс: очки и закрытые темы ------------------------------------------
//
// Ключ "sabaqtas-progress", внутри { points: <число>, closed: [<topic_id>, ...] }.
// points — сумма очков за все пройденные сессии заданий,
// closed — id тем, в которых ученик прошёл все задания до конца.
// closedAt — когда именно каждая из них закрыта: { "<topic_id>": "YYYY-MM-DD" }.
// Отдельным объектом, а не полем внутри closed: closed остаётся простым
// списком id, и всё, что его читает, работает как раньше.

// Прогресс с нуля. Каждый раз новый объект: вызывающий код его меняет
// (прибавляет очки, дописывает тему), и один общий объект на всех был бы
// ошибкой.
function emptyProgress() {
  return { points: 0, closed: [], closedAt: {} };
}

// Сохранённый прогресс или прогресс с нуля. С нуля — при любой неожиданности:
// записи нет, JSON битый, форма не та, localStorage недоступен (приватный
// режим). Наружу ошибки не выходят: кабинет обязан открыться в любом случае.
function readProgress() {
  try {
    const raw = localStorage.getItem("sabaqtas-progress");
    if (!raw) {
      return emptyProgress();
    }
    const progress = JSON.parse(raw);
    // JSON.parse может вернуть что угодно («null», число, строку).
    // Прогрессом считаем только объект с числом очков и списком тем.
    if (!progress || typeof progress !== "object") {
      return emptyProgress();
    }
    if (typeof progress.points !== "number" || !Array.isArray(progress.closed)) {
      return emptyProgress();
    }
    // closedAt появился позже closed, поэтому у старых записей его нет.
    // Из-за одной недостающей даты весь прогресс терять нельзя: подставляем
    // пустой объект. Массив тоже не подходит — ждём словарь id -> дата.
    let closedAt = progress.closedAt;
    if (!closedAt || typeof closedAt !== "object" || Array.isArray(closedAt)) {
      closedAt = {};
    }
    return { points: progress.points, closed: progress.closed, closedAt: closedAt };
  } catch (error) {
    return emptyProgress();
  }
}

// Записать прогресс. Любое обращение к localStorage — через try/catch,
// как и saveProfile в login.js: в приватном режиме он бросает исключение,
// а экран из-за этого падать не должен. Причина остаётся в консоли.
function saveProgress(progress) {
  try {
    localStorage.setItem("sabaqtas-progress", JSON.stringify(progress));
  } catch (error) {
    console.log("Не удалось сохранить прогресс: " + error.message);
  }
}

// --- Итог диагностики --------------------------------------------------------
//
// Ключ "sabaqtas-diagnostic", внутри
//   { root_topic_id: <topic_id или null>, failed: [<topic_id>, ...] }.
// root_topic_id — корневой пробел, null — пробелов не нашли.
// failed — все проваленные темы в порядке спуска, сверху вниз.

// Сохранённый итог или null. null — при любой неожиданности: записи нет,
// JSON битый, форма не та, localStorage недоступен. Наружу ошибки не выходят.
function readDiagnostic() {
  try {
    const raw = localStorage.getItem("sabaqtas-diagnostic");
    if (!raw) {
      return null;
    }
    const diagnostic = JSON.parse(raw);
    if (!diagnostic || typeof diagnostic !== "object") {
      return null;
    }
    // root_topic_id — строка или null, failed — массив. Иначе запись битая.
    const rootOk = diagnostic.root_topic_id === null || typeof diagnostic.root_topic_id === "string";
    if (!rootOk || !Array.isArray(diagnostic.failed)) {
      return null;
    }
    return { root_topic_id: diagnostic.root_topic_id, failed: diagnostic.failed };
  } catch (error) {
    return null;
  }
}

// Записать итог. Та же защита, что у saveProgress: ошибка localStorage
// (приватный режим) не должна ронять экран, причина остаётся в консоли.
function saveDiagnostic(diagnostic) {
  try {
    localStorage.setItem("sabaqtas-diagnostic", JSON.stringify(diagnostic));
  } catch (error) {
    console.log("Не удалось сохранить итог диагностики: " + error.message);
  }
}
