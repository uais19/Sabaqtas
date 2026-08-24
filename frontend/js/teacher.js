// teacher.js — простая отрисовка панели учителя из TEACHER_MOCK.
// Все комментарии оставлены подробными, чтобы код можно было объяснить по строкам.

if (typeof TEACHER_MOCK === "undefined") {
  document.querySelector(".teacher-page").innerHTML =
    "<p class=\"teacher-error\">" + t("teacher.error",
      "Не удалось загрузить данные класса. Обновите страницу.") + "</p>";
} else {
  renderTeacherPage();
}

function renderTeacherPage() {
  const students = TEACHER_MOCK.students;
  let closedGaps = 0;
  let stuckStudents = 0;

  document.getElementById("class-title").textContent = TEACHER_MOCK.class_title;

  // Считаем две общие величины из карточки каждого ученика.
  //
  // Закрытые пробелы складываем: это события, их сумма осмысленна.
  // А застрявших СЧИТАЕМ ПО ГОЛОВАМ, а не складываем застревания. Иначе
  // выходит бессмыслица: у пятерых учеников набирается семь застреваний,
  // и плитка показывает «застряли 7» при пяти учениках в классе.
  students.forEach(function (student) {
    closedGaps += student.closed_gaps;
    if (student.gave_up_count > 0) {
      stuckStudents += 1;
    }
  });

  document.getElementById("tile-students").textContent = students.length;
  document.getElementById("tile-closed").textContent = closedGaps;
  document.getElementById("tile-gaveup").textContent = stuckStudents;

  const studentsBody = document.getElementById("students-body");
  students.forEach(function (student) {
    studentsBody.append(createStudentRow(student));
  });

  const topicsBlock = document.getElementById("class-topics");
  TEACHER_MOCK.class_stats.forEach(function (topic) {
    topicsBlock.append(createTopicRow(topic));
  });

  document.getElementById("add-topic-form").addEventListener("submit", addTopic);
}

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

// Создаём тонкую полосу и ограничиваем её значение диапазоном от 0 до 100.
function createProgressBar(percent, colorClass) {
  const safePercent = Math.max(0, Math.min(100, percent));
  const track = document.createElement("div");
  const fill = document.createElement("div");

  track.className = "bar-track";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", safePercent);
  fill.className = "bar-fill " + colorClass;
  fill.style.width = safePercent + "%";
  track.append(fill);

  return track;
}

// Одна строка таблицы соответствует одному ученику.
function createStudentRow(student) {
  const row = document.createElement("tr");
  const nameCell = document.createElement("td");
  const topicCell = document.createElement("td");
  const gapGradeCell = document.createElement("td");
  const progressCell = document.createElement("td");
  const gaveUpCell = document.createElement("td");
  const name = document.createElement("p");
  const topic = document.createElement("p");
  const source = document.createElement("p");
  const progressBox = document.createElement("div");
  const percent = document.createElement("span");

  name.className = "student-name";
  name.textContent = student.name;
  nameCell.append(name);

  topic.className = "gap-title";
  topic.textContent = t("topic." + student.root_topic.topic_id, student.root_topic.title);
  source.className = "gap-source";
  source.textContent = paragraphOnly(student.root_topic.source_ref);
  topicCell.append(topic, source);

  gapGradeCell.className = "gap-grade-cell";
  gapGradeCell.textContent = tFormat("common.gradeLabel", "{n} класс",
    { n: student.root_topic.grade });

  progressBox.className = "progress-box";
  progressBox.append(createProgressBar(student.progress_percent, "bar-accent"));
  percent.className = "progress-percent";
  percent.textContent = student.progress_percent + "%";
  progressBox.append(percent);
  progressCell.append(progressBox);

  gaveUpCell.className = "gaveup-cell";
  gaveUpCell.textContent = student.gave_up_count;

  row.append(nameCell, topicCell, gapGradeCell, progressCell, gaveUpCell);
  return row;
}

// Согласуем существительное с числом: 1 ученик, 2 ученика, 5 учеников.
// forms — три формы подряд: для 1, для 2–4, для 5 и больше.
//
// Дробное число всегда берёт вторую форму: «3.7 подсказки», «1.4 подсказки».
// Так в русском языке и есть, отдельного правила придумывать не нужно.
function plural(count, forms) {
  if (count % 1 !== 0) {
    return forms[1];
  }
  const hundreds = Math.abs(count) % 100;
  const units = hundreds % 10;
  // Числа от 11 до 14 — исключение: «11 учеников», а не «11 ученик».
  if (hundreds > 10 && hundreds < 20) {
    return forms[2];
  }
  if (units > 1 && units < 5) {
    return forms[1];
  }
  if (units === 1) {
    return forms[0];
  }
  return forms[2];
}

// Одна строка показывает состояние одной темы у всего класса.
function createTopicRow(topic) {
  const row = document.createElement("article");
  const title = document.createElement("p");
  const source = document.createElement("p");
  const progressBox = document.createElement("div");
  const percent = document.createElement("span");
  const details = document.createElement("p");
  const isHot = topic.students_struggling > TEACHER_MOCK.students.length / 2;

  row.className = "class-topic";
  title.className = "class-topic-title";
  // Добавленная руками тема идентификатора не имеет — тогда остаётся как есть
  title.textContent = topic.topic_id ? t("topic." + topic.topic_id, topic.title) : topic.title;
  source.className = "class-topic-source";
  // Источник у темы может быть пустым: у добавленных вручную тем его нет.
  source.textContent = topic.source_ref ? paragraphOnly(topic.source_ref) : "";

  // Золотой цвет означает: с темой застряло больше половины класса.
  if (isHot) {
    const caption = document.createElement("span");
    caption.className = "hot-caption";
    caption.textContent = t("teacher.explainTomorrow", "объяснить завтра");
    row.classList.add("is-hot");
    title.append(caption);
  }

  progressBox.className = "progress-box";
  progressBox.append(createProgressBar(topic.avg_mastery, isHot ? "bar-gold" : "bar-accent"));
  percent.className = "progress-percent";
  percent.textContent = topic.avg_mastery + "%";
  progressBox.append(percent);

  details.className = "class-topic-detail";
  // На казахском строка собирается шаблоном: там у существительных нет
  // отдельных форм для 1, 2-4 и 5+, и согласовывать нечего.
  const kazakhLine = t("teacher.topicDetails", "");
  if (kazakhLine) {
    // Десятичный разделитель: в казахской записи запятая, а не точка
    const hints = String(topic.avg_hints).replace(".", ",");
    details.textContent = tFormat("teacher.topicDetails", "",
      { count: topic.students_struggling, hints: hints });
  } else {
    details.textContent = topic.students_struggling + " " +
      plural(topic.students_struggling, ["ученик", "ученика", "учеников"]) + " " +
      plural(topic.students_struggling, ["застрял", "застряли", "застряли"]) +
      " · в среднем " + topic.avg_hints + " " +
      plural(topic.avg_hints, ["подсказка", "подсказки", "подсказок"]);
  }

  row.append(title);
  if (topic.source_ref) row.append(source);
  row.append(progressBox, details);
  return row;
}

// Новая тема существует только в DOM: после обновления страницы она исчезнет.
function addTopic(event) {
  event.preventDefault();

  const titleInput = document.getElementById("add-title");
  const sourceInput = document.getElementById("add-source");
  const title = titleInput.value.trim();
  const source = sourceInput.value.trim();

  if (title === "" || source === "") {
    window.alert(t("teacher.addError", "Заполните тему и источник."));
    return;
  }

  const topic = {
    title: title,
    grade: Number(document.getElementById("add-grade").value),
    source_ref: source,
    avg_mastery: 0,
    students_struggling: 0,
    avg_hints: 0,
    gave_up_count: 0
  };

  document.getElementById("class-topics").append(createTopicRow(topic));
  event.target.reset();
}
