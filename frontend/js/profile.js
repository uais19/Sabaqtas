// profile.js — чтение профиля ученика из localStorage.
// Общий помощник: анкету заполняют на login.html, а показывают её на
// других экранах. Профиля может не быть — жюри способно открыть любую
// страницу по прямой ссылке, и это не должно ничего ломать.

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
  if (goal === "gaps") return "Закрыть пробелы за прошлые годы";
  if (goal === "current") return "Подтянуть текущую тему";
  if (goal === "ent") return "Подготовка к ЕНТ";
  if (goal === "olympiad") return "Подготовка к олимпиаде";
  return "";
}

// Одно предложение о том, как выбранная цель связана с планом «снизу вверх».
// Неизвестный код — пустая строка, и строка на экране просто не показывается.
function goalNote(goal) {
  if (goal === "ent") return "Тесты ЕНТ проверяют старшие классы, но ошибки чаще идут от пробелов ниже. Поэтому план начинается снизу.";
  if (goal === "gaps") return "Именно для этого план и построен снизу вверх — от корневого пробела, а не от текущей темы.";
  if (goal === "current") return "Текущую тему разберём, когда закроем то, на чём она стоит.";
  if (goal === "olympiad") return "Олимпиадные задачи стоят на школьной базе. Сначала убедимся, что в ней нет дыр.";
  return "";
}

// Код уровня подготовки из анкеты -> человеческий текст. Неизвестный код —
// пустая строка. Профили, сохранённые до появления этого поля, уровня не
// имеют: там придёт undefined, и строка на экране просто не показывается.
function levelLabel(level) {
  if (level === "weak") return "Многое забыл";
  if (level === "medium") return "Средний";
  if (level === "strong") return "Уверенно себя чувствую";
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
