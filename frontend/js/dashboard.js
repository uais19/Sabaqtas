// dashboard.js — личный кабинет ученика: корневой пробел, план обучения,
// прогресс и слабые места.
//
// Почти все данные берём из mock.js: бэкенда для этого экрана ещё нет,
// а показать полную картину на демо нужно уже сейчас. По-настоящему
// считаются только очки и закрытые темы: их экран заданий пишет в
// localStorage, а здесь мы их читаем (readProgress в profile.js).
// Комментарии подробные — код должен объясняться по строкам.

function renderDashboard() {
  // Очки и закрытые темы из localStorage. Читаем один раз: план и плитки
  // прогресса должны видеть одни и те же цифры.
  const stored = readProgress();

  renderProfileLines();
  renderRootGap();
  renderPlan(stored);
  renderProgress(stored);
  renderWeakSpots();
}

// --- Имя и цель из анкеты ---
// Профиля может не быть: страницу открыли по прямой ссылке. Тогда шапка
// остаётся «Мой план», а строка цели — скрытой. Ничего не ломается.
function renderProfileLines() {
  const profile = readProfile();
  if (!profile) {
    return;
  }

  // Кабинет — экран ученика. Учитель может открыть его из демо, но ни имени
  // в заголовке, ни цели, ни уровня, ни срока ему показывать нечего: всё это
  // поля ученической анкеты. Для любой роли, кроме ученика, страница
  // выглядит так же, как без профиля вообще.
  if (profile.role !== "student") {
    return;
  }

  if (profile.name) {
    document.getElementById("header-title").textContent = "Мой план — " + profile.name;
  }

  const label = goalLabel(profile.goal);
  if (label) {
    const goalLine = document.getElementById("goal-line");
    goalLine.textContent = "Цель: " + label;
    goalLine.classList.remove("is-hidden");
  }

  // Пояснение под целью: как она связана с планом «снизу вверх».
  // Свой независимый страж: нет текста — строка остаётся скрытой.
  const note = goalNote(profile.goal);
  if (note) {
    const goalNoteLine = document.getElementById("goal-note");
    goalNoteLine.textContent = note;
    goalNoteLine.classList.remove("is-hidden");
  }

  // Уровень подготовки, который ученик указал на входе. Тоже со своим
  // стражем: у профилей, сохранённых до появления этого поля, level нет —
  // levelLabel вернёт пустую строку, и строка останется скрытой.
  const level = levelLabel(profile.level);
  if (level) {
    const levelLine = document.getElementById("level-line");
    levelLine.textContent = "Уровень на старте: " + level;
    levelLine.classList.remove("is-hidden");
  }

  // Ближайшая цель: обратный отсчёт до даты из анкеты. Даты может не быть
  // (поле необязательное), она может быть битой или уже прошедшей — во всех
  // этих случаях daysUntil вернёт null, и раздел целиком остаётся скрытым.
  const days = daysUntil(profile.deadline);
  if (days !== null) {
    // Если цель не указана или код неизвестен, пишем просто «Цель».
    const goalName = goalLabel(profile.goal) || "Цель";
    document.getElementById("deadline-line").textContent =
      goalName + ": осталось " + days + " " + daysWord(days);
    document.getElementById("deadline-note").textContent =
      "Дата: " + formatLongDate(profile.deadline);
    document.getElementById("deadline-section").classList.remove("is-hidden");
  }
}

// --- Общие мелочи ------------------------------------------------------------

// В интерфейсе показываем только параграф, без страницы: у разных изданий
// учебника страницы разные, а параграф один и тот же.
// «Математика, 5 класс, часть 1, §23, стр. 112» -> «Математика, 5 класс, часть 1, §23».
function paragraphOnly(sourceRef) {
  const index = sourceRef.indexOf(", стр.");
  if (index === -1) {
    return sourceRef;
  }
  return sourceRef.slice(0, index);
}

// «2026-08-14» -> «14.08.2026»
function formatDate(isoDate) {
  const parts = isoDate.split("-");
  return parts[2] + "." + parts[1] + "." + parts[0];
}

// Подпись под закрытой темой. Дата известна не всегда: темы, закрытые до
// того, как мы начали её записывать, даты не имеют. Тогда пишем фразу без
// даты — выдумывать её нельзя, а «Закрыто .» выглядело бы поломкой.
function closedReason(closedDate) {
  if (typeof closedDate !== "string" || closedDate === "") {
    return "Закрыто. Эта тема больше не мешает.";
  }
  return "Закрыто " + formatDate(closedDate) + ". Эта тема больше не мешает.";
}

// Месяцы в родительном падеже — для даты вида «15 июня 2027».
// Свой список, а не toLocaleDateString: тот в разных браузерах даёт разный вывод.
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

// «2027-06-15» -> «15 июня 2027». Число без ведущего нуля: «5 мая», а не «05 мая».
// Сюда попадает только строка, которую daysUntil уже признал настоящей датой.
function formatLongDate(isoDate) {
  const parts = isoDate.split("-");
  const day = Number(parts[2]);
  const month = MONTHS_GENITIVE[Number(parts[1]) - 1];
  return day + " " + month + " " + parts[0];
}

// Слово «день» в нужной форме: 1 день, 2 дня, 5 дней, 21 день, 111 дней.
function daysWord(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  // 11–14 — всегда «дней», хотя оканчиваются на 1–4.
  if (lastTwo >= 11 && lastTwo <= 14) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
}

// Значок класса рядом с названием темы.
function createGradeBadge(grade) {
  const badge = document.createElement("span");
  badge.className = "grade-badge";
  badge.textContent = grade + " класс";
  return badge;
}

// --- Блок 1: корневой пробел -------------------------------------------------

function renderRootGap() {
  const root = MOCK.progress.root_topic;
  document.getElementById("root-title").textContent =
    root.title + " · " + root.grade + " класс";
  document.getElementById("root-source").textContent = paragraphOnly(root.source_ref);
}

// --- Блок 2: план обучения ---------------------------------------------------

// Значки состояния темы. Текстовые, без картинок: грузить нечего.
const STATE_ICONS = {
  closed: "✓",
  current: "●",
  ahead: "○"
};

// Класс темы лежит в progress.topics, а в plan.items его нет — ищем по id.
function gradeOfTopic(topicId) {
  const found = MOCK.progress.topics.find(function (topic) {
    return topic.topic_id === topicId;
  });
  return found ? found.grade : null;
}

function renderPlan(stored) {
  const list = document.getElementById("plan-list");

  // Сначала уже закрытые пробелы: они ниже корневого по цепочке и показывают
  // ученику, что часть пути пройдена. Ссылки на учебник у них в данных нет.
  MOCK.progress.closed_gaps.forEach(function (gap) {
    list.append(createPlanRow({
      topicId: gap.topic_id,
      title: gap.title,
      grade: gap.grade,
      source: "",
      reason: closedReason(gap.closed_at),
      state: "closed"
    }));
  });

  // Дальше сам план: он начинается с корневого пробела и поднимается вверх,
  // до темы текущего класса.
  //
  // Состояние строки. Тема, которую ученик прошёл на экране заданий, —
  // закрыта (её id лежит в stored.closed). Текущая — ПЕРВАЯ незакрытая
  // сверху: план идёт снизу вверх по цепочке, и заниматься надо следующей
  // по ней. Всё, что идёт после текущей, — впереди. Если закрыто всё,
  // текущей строки нет, и кнопка «Заниматься» не появляется ни у кого.
  let currentFound = false;
  MOCK.plan.items.forEach(function (item) {
    let state;
    let reason = item.reason;
    if (stored.closed.indexOf(item.topic_id) !== -1) {
      state = "closed";
      // Та же фраза, что у закрытых пробелов из mock. Дату экран заданий
      // теперь записывает (closedAt в profile.js), но у тем, закрытых до
      // этого, её нет — тогда строка просто идёт без даты.
      reason = closedReason(stored.closedAt[item.topic_id]);
    } else if (!currentFound) {
      state = "current";
      currentFound = true;
    } else {
      state = "ahead";
    }

    list.append(createPlanRow({
      topicId: item.topic_id,
      title: item.title,
      grade: gradeOfTopic(item.topic_id),
      source: paragraphOnly(item.source_ref),
      reason: reason,
      state: state
    }));
  });
}

// Одна строка плана. row — простой объект с уже готовыми полями,
// чтобы эта функция не знала, откуда взялись данные.
function createPlanRow(row) {
  const item = document.createElement("li");
  item.className = "plan-item is-" + row.state;

  // Значок состояния. Для чтения с экрана он бесполезен, поэтому прячем
  // его от программ чтения: состояние понятно по тексту строки.
  const icon = document.createElement("span");
  icon.className = "plan-icon";
  icon.textContent = STATE_ICONS[row.state];
  icon.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "plan-body";

  const title = document.createElement("p");
  title.className = "plan-title";
  title.textContent = row.title;
  if (row.grade) {
    title.append(" ", createGradeBadge(row.grade));
  }
  body.append(title);

  // Источник есть не у всех строк: у закрытых пробелов его в данных нет,
  // а выдумывать ссылку на учебник нельзя.
  if (row.source) {
    const source = document.createElement("p");
    source.className = "plan-source";
    source.textContent = row.source;
    body.append(source);
  }

  const reason = document.createElement("p");
  reason.className = "plan-reason";
  reason.textContent = row.reason;
  body.append(reason);

  // Переход к теме. Каждая строка ведёт на свою тему: topic.html?topic=<id>.
  // У текущей темы — главная кнопка «Заниматься»: с неё и надо начинать,
  // в этом смысл плана. У остальных незакрытых тем, для которых в
  // MOCK.topicTasks есть задания, — тихая ссылка «Посмотреть», нарочно
  // менее заметная. Закрытые темы и темы без заданий ссылки не получают.
  const hasTasks = MOCK.topicTasks.hasOwnProperty(row.topicId);
  if (row.state === "current") {
    const link = document.createElement("a");
    link.className = "button button-primary plan-button";
    link.href = "topic.html?topic=" + row.topicId;
    link.textContent = "Заниматься";
    body.append(link);
  } else if (row.state === "ahead" && hasTasks) {
    const link = document.createElement("a");
    link.className = "link-button";
    link.href = "topic.html?topic=" + row.topicId;
    link.textContent = "Посмотреть";
    body.append(link);
  }

  item.append(icon, body);
  return item;
}

// --- Блок 3: прогресс --------------------------------------------------------

function renderProgress(stored) {
  const progress = MOCK.progress;

  // Очки — настоящие, из localStorage: их начисляет экран заданий.
  document.getElementById("tile-points").textContent = stored.points;
  // Серия дней остаётся из mock нарочно: считать её по-настоящему мы пока
  // не умеем, а полусделанный счётчик хуже честной заглушки.
  document.getElementById("tile-streak").textContent = progress.streak_days;
  // Закрытые пробелы: те, что уже были в данных, плюс темы, которые ученик
  // закрыл сам на экране заданий.
  document.getElementById("tile-closed").textContent =
    progress.closed_gaps.length + stored.closed.length;

  // Список полученных достижений — это id из mock.js.
  const earnedIds = progress.achievements.map(function (achievement) {
    return achievement.id;
  });

  // Показываем весь набор значков: полученные цветом, остальные тускло —
  // так видно, к чему ещё можно стремиться. Ничего не выдумываем:
  // каждый значок либо есть в данных, либо считается по ним.
  const badges = [
    {
      title: "Первый закрытый пробел",
      // Есть хотя бы один закрытый пробел: в данных или закрытый учеником.
      earned: progress.closed_gaps.length > 0 || stored.closed.length > 0
    },
    {
      title: "Серия 3 дня",
      earned: progress.streak_days >= 3
    },
    {
      title: "Дошёл без подсказки",
      earned: earnedIds.indexOf("ach_no_hints") !== -1
    },
    {
      title: "Первая диагностика",
      earned: earnedIds.indexOf("ach_first_diag") !== -1
    }
  ];

  const list = document.getElementById("badge-list");
  badges.forEach(function (badge) {
    const item = document.createElement("li");
    item.className = badge.earned ? "badge is-earned" : "badge";
    item.textContent = badge.title;
    list.append(item);
  });
}

// --- Блок 4: слабые места ----------------------------------------------------

// Ниже этой доли освоения тему считаем непрочной.
const WEAK_LIMIT = 50;

// Ссылку на учебник берём из плана: в progress.topics её нет.
function sourceOfTopic(topicId) {
  const found = MOCK.plan.items.find(function (item) {
    return item.topic_id === topicId;
  });
  return found ? paragraphOnly(found.source_ref) : "";
}

function renderWeakSpots() {
  const list = document.getElementById("weak-list");

  const weakTopics = MOCK.progress.topics.filter(function (topic) {
    return topic.mastery < WEAK_LIMIT;
  });

  weakTopics.forEach(function (topic) {
    const item = document.createElement("li");
    item.className = "weak-item";

    const title = document.createElement("p");
    title.className = "weak-title";
    title.textContent = topic.title;
    title.append(" ", createGradeBadge(topic.grade));
    item.append(title);

    const source = sourceOfTopic(topic.topic_id);
    if (source) {
      const sourceLine = document.createElement("p");
      sourceLine.className = "weak-source";
      sourceLine.textContent = source;
      item.append(sourceLine);
    }

    const mastery = document.createElement("p");
    mastery.className = "weak-mastery";
    mastery.textContent = "Освоено " + topic.mastery + "%";
    item.append(mastery);

    list.append(item);
  });
}

// --- Запуск ------------------------------------------------------------------

// Запускаем в самом низу файла: константы выше объявлены через const,
// а до них добраться нужно раньше, чем ими воспользуются.
if (typeof MOCK === "undefined") {
  document.querySelector(".dash-page").innerHTML =
    "<p class=\"dash-error\">Не удалось загрузить данные. Обновите страницу.</p>";
} else {
  renderDashboard();
}
