// dashboard.js — личный кабинет ученика: корневой пробел, план обучения,
// прогресс и слабые места.
//
// Все данные берём из mock.js и ничего не считаем сами: бэкенда для этого
// экрана ещё нет, а показать полную картину на демо нужно уже сейчас.
// Комментарии подробные — код должен объясняться по строкам.

function renderDashboard() {
  renderProfileLines();
  renderRootGap();
  renderPlan();
  renderProgress();
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

// Состояние темы: «в работе» — это текущая тема, остальные ещё впереди.
// Закрытые темы в plan.items не попадают, они лежат отдельно в closed_gaps.
function stateOfTopic(topicId) {
  const found = MOCK.progress.topics.find(function (topic) {
    return topic.topic_id === topicId;
  });
  if (found && found.status === "в работе") {
    return "current";
  }
  return "ahead";
}

function renderPlan() {
  const list = document.getElementById("plan-list");

  // Сначала уже закрытые пробелы: они ниже корневого по цепочке и показывают
  // ученику, что часть пути пройдена. Ссылки на учебник у них в данных нет.
  MOCK.progress.closed_gaps.forEach(function (gap) {
    list.append(createPlanRow({
      title: gap.title,
      grade: gap.grade,
      source: "",
      reason: "Закрыто " + formatDate(gap.closed_at) + ". Эта тема больше не мешает.",
      state: "closed"
    }));
  });

  // Дальше сам план: он начинается с корневого пробела и поднимается вверх,
  // до темы текущего класса.
  MOCK.plan.items.forEach(function (item) {
    list.append(createPlanRow({
      title: item.title,
      grade: gradeOfTopic(item.topic_id),
      source: paragraphOnly(item.source_ref),
      reason: item.reason,
      state: stateOfTopic(item.topic_id)
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

  // Кнопка только у текущей темы: закрытые уже пройдены,
  // а до будущих ещё рано — в этом и смысл плана.
  if (row.state === "current") {
    const link = document.createElement("a");
    link.className = "button button-primary plan-button";
    link.href = "topic.html";
    link.textContent = "Заниматься";
    body.append(link);
  }

  item.append(icon, body);
  return item;
}

// --- Блок 3: прогресс --------------------------------------------------------

function renderProgress() {
  const progress = MOCK.progress;

  document.getElementById("tile-points").textContent = progress.points;
  document.getElementById("tile-streak").textContent = progress.streak_days;
  document.getElementById("tile-closed").textContent = progress.closed_gaps.length;

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
      earned: earnedIds.indexOf("ach_first_gap") !== -1
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
