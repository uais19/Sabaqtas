// teacher.js — отрисовка панели учителя из объекта TEACHER_MOCK.
// Никакой логики на сервере: страница просто показывает данные.

// Если файл с данными не подключился, честно говорим об этом
// вместо пустой сломанной страницы.
if (typeof TEACHER_MOCK === "undefined") {
  document.querySelector(".teacher-page").innerHTML =
    "<p class=\"teacher-error\">Не удалось загрузить данные класса. Обнови страницу.</p>";
} else {
  renderTeacherPage();
}

function renderTeacherPage() {
  const students = TEACHER_MOCK.students;

  document.getElementById("class-title").textContent = TEACHER_MOCK.class_title;

  // --- Плитки: считаем сводку прямо из списка учеников ---
  let closedTotal = 0;
  let gaveUpTotal = 0;
  students.forEach(function (student) {
    closedTotal += student.closed_gaps;
    gaveUpTotal += student.gave_up_count;
  });
  document.getElementById("tile-students").textContent = students.length;
  document.getElementById("tile-closed").textContent = closedTotal;
  document.getElementById("tile-gaveup").textContent = gaveUpTotal;

  // --- Таблица учеников ---
  const tbody = document.getElementById("students-body");
  students.forEach(function (student) {
    tbody.append(createStudentRow(student));
  });

  // --- Блок «Что западает у класса» ---
  TEACHER_MOCK.class_stats.forEach(function (topic) {
    document.getElementById("class-topics").append(createTopicRow(topic));
  });

  // --- Форма «Добавить тему» ---
  document.getElementById("add-topic-form").addEventListener("submit", addTopic);
}

// Тонкая полоса прогресса: серая дорожка и цветная заливка на percent процентов.
function createBar(percent, extraClass) {
  const track = document.createElement("div");
  track.className = "bar-track";
  const fill = document.createElement("div");
  fill.className = "bar-fill " + extraClass;
  fill.style.width = percent + "%";
  track.append(fill);
  return track;
}

// Строка таблицы про одного ученика.
function createStudentRow(student) {
  const row = document.createElement("tr");

  // Имя и дата последнего захода
  const nameCell = document.createElement("td");
  const name = document.createElement("p");
  name.className = "student-name";
  name.textContent = student.name;
  const active = document.createElement("p");
  active.className = "student-active";
  active.textContent = "заходил(а) " + student.last_active;
  nameCell.append(name, active);

  // Корневой пробел: тема, значок класса, под ними источник
  const gapCell = document.createElement("td");
  const topicLine = document.createElement("p");
  topicLine.className = "gap-title";
  topicLine.textContent = student.root_topic.title + " ";
  const badge = document.createElement("span");
  badge.className = "grade-badge";
  badge.textContent = student.root_topic.grade + " класс";
  topicLine.append(badge);
  const source = document.createElement("p");
  source.className = "gap-source";
  source.textContent = student.root_topic.source_ref;
  gapCell.append(topicLine, source);

  // Прогресс: полоса и процент рядом
  const progressCell = document.createElement("td");
  const progressBox = document.createElement("div");
  progressBox.className = "progress-box";
  progressBox.append(createBar(student.progress_percent, "bar-accent"));
  const percent = document.createElement("span");
  percent.className = "progress-percent";
  percent.textContent = student.progress_percent + "%";
  progressBox.append(percent);
  progressCell.append(progressBox);

  // Сколько раз сдался
  const gaveUpCell = document.createElement("td");
  gaveUpCell.className = "gaveup-cell";
  gaveUpCell.textContent = student.gave_up_count;

  row.append(nameCell, gapCell, progressCell, gaveUpCell);
  return row;
}

// Карточка темы в блоке «Что западает у класса».
function createTopicRow(topic) {
  const card = document.createElement("div");
  card.className = "class-topic";

  // Тема западает у большинства — выделяем золотом:
  // её стоит объяснить всему классу, не дожидаясь платформы.
  const isHot = topic.students_struggling > TEACHER_MOCK.students.length / 2;
  if (isHot) card.classList.add("is-hot");

  const titleLine = document.createElement("p");
  titleLine.className = "class-topic-title";
  titleLine.textContent = topic.title + " ";
  const badge = document.createElement("span");
  badge.className = "grade-badge";
  badge.textContent = topic.grade + " класс";
  titleLine.append(badge);
  if (isHot) {
    const hot = document.createElement("span");
    hot.className = "hot-caption";
    hot.textContent = "объяснить завтра";
    titleLine.append(hot);
  }

  const barBox = document.createElement("div");
  barBox.className = "progress-box";
  barBox.append(createBar(topic.avg_mastery, isHot ? "bar-gold" : "bar-accent"));
  const percent = document.createElement("span");
  percent.className = "progress-percent";
  percent.textContent = topic.avg_mastery + "%";
  barBox.append(percent);

  const detail = document.createElement("p");
  detail.className = "class-topic-detail";
  detail.textContent = topic.students_struggling + " учеников застряли · в среднем " +
    topic.avg_hints + " подсказок";

  card.append(titleLine, barBox, detail);
  return card;
}

// «Добавить тему»: новая карточка появляется в блоке выше.
// Данные никуда не сохраняются — это работает только на этой странице.
function addTopic(event) {
  event.preventDefault(); // не перезагружать страницу

  const title = document.getElementById("add-title").value.trim();
  const source = document.getElementById("add-source").value.trim();
  if (title === "" || source === "") return;

  const topic = {
    // Источник показываем в скобках после названия: у новой темы
    // ещё нет статистики, но откуда она — учитель видит сразу.
    title: title + " (" + source + ")",
    grade: Number(document.getElementById("add-grade").value),
    avg_mastery: 0,
    students_struggling: 0,
    avg_hints: 0,
    gave_up_count: 0
  };

  document.getElementById("class-topics").append(createTopicRow(topic));
  event.target.reset();
}
