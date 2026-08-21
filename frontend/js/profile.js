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
  return "";
}
