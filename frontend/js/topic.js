// topic.js — экран темы и заданий.
//
// Показываем правило из учебника и три задания подряд, по одному за раз.
// Главное правило экрана: при неверном ответе НИКОГДА не показываем верный.
// Ученик должен дойти до него сам — ради этого продукт и делается.
// «Показать ответ» появляется только после третьей неудачной попытки
// и выглядит как тихая второстепенная ссылка, а не как выход из положения.

// --- Данные экрана -----------------------------------------------------------

// Тема экрана — текущая тема плана, то есть корневой пробел ученика.
const TOPIC = MOCK.progress.root_topic;

// Правило из учебника берём из готового ответа ИИ в mock.js: это настоящий
// фрагмент параграфа вместе со ссылкой на книгу.
const MATERIAL = MOCK.askExplain.sources[0];

// Шаг диагностики по этой теме — из него берём первое задание.
function findDiagnosticStep(topicId) {
  return MOCK.diagnosticChain.find(function (step) {
    return step.topic_id === topicId;
  });
}

const ROOT_STEP = findDiagnosticStep(TOPIC.id);

// Три задания на тему.
//
// Первое — тот самый вопрос, на котором диагностика нашла пробел: берём
// его из mock.js целиком, вместе с подсказкой наставника и разбором.
// Двух других заданий в mock.js нет, а править mock.js нельзя, поэтому
// они описаны здесь же — по образцу первого и на том же параграфе §23.
const TASKS = [
  {
    text: ROOT_STEP.question.text,
    options: ROOT_STEP.question.options,
    correct_index: ROOT_STEP.question.correct_index,
    hint: MOCK.mentorReply.reply,
    explanation: MOCK.askExplain.answer
  },
  {
    text: "Вычислите: 5/8 − 1/4",
    options: ["3/8", "4/4", "1/2", "4/8"],
    correct_index: 0,
    hint: "Знаменатели 8 и 4 разные. Во сколько раз 8 больше 4 — и что тогда " +
      "нужно сделать с дробью 1/4, чтобы у неё стал знаменатель 8?",
    explanation: "Общий знаменатель — 8. Дробь 1/4 умножаем на 2 и получаем 2/8. " +
      "Потом вычитаем числители: 5/8 − 2/8 = 3/8."
  },
  {
    text: "Вычислите: 1/2 + 1/3",
    options: ["2/5", "2/6", "5/6", "1/5"],
    correct_index: 2,
    hint: "Здесь ни один знаменатель не получается из другого умножением. " +
      "Какое самое маленькое число делится и на 2, и на 3?",
    explanation: "Общий знаменатель — 6: 1/2 это 3/6, а 1/3 это 2/6. " +
      "Складываем числители: 3/6 + 2/6 = 5/6."
  }
];

// Очки: с первой попытки — 10, после ошибок — 5, за показанный ответ — 0.
const POINTS_FIRST_TRY = 10;
const POINTS_LATER = 5;

// После стольких неудачных попыток предлагаем «Показать ответ».
const ATTEMPTS_BEFORE_REVEAL = 3;

// --- Состояние ---------------------------------------------------------------

let taskIndex = 0;        // какое задание показываем сейчас
let attempts = 0;         // неудачные попытки на текущем задании
let points = 0;           // набрано очков за тему
let firstTryCount = 0;    // сколько заданий решено с первой попытки
let answerButtons = [];   // кнопки вариантов текущего задания

// --- Запуск ------------------------------------------------------------------

function startTopic() {
  renderHeader();
  renderMaterial();
  renderTask();
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

function renderHeader() {
  document.getElementById("topic-title").textContent = TOPIC.title;
  document.getElementById("topic-grade").textContent = TOPIC.grade + " класс";
  document.getElementById("topic-source").textContent = paragraphOnly(TOPIC.source_ref);
}

function renderMaterial() {
  document.getElementById("material-text").textContent = MATERIAL.snippet;
  // Книга и параграф — без страницы, как и везде на этих экранах.
  document.getElementById("material-source").textContent =
    "Источник: " + MATERIAL.book + ", " + MATERIAL.paragraph;
}

// Такая же плашка источника, как в чате: те же классы, тот же вид.
function createSourceBadge() {
  const box = document.createElement("div");
  box.className = "msg-sources";

  const badge = document.createElement("span");
  badge.className = "source-badge";
  badge.textContent = "Источник: " + paragraphOnly(TOPIC.source_ref);

  box.append(badge);
  return box;
}

// --- Задание -----------------------------------------------------------------

function renderTask() {
  const task = TASKS[taskIndex];
  attempts = 0;
  answerButtons = [];

  document.getElementById("task-progress").textContent =
    "Задание " + (taskIndex + 1) + " из " + TASKS.length;
  document.getElementById("task-text").textContent = task.text;

  const answers = document.getElementById("task-answers");
  answers.textContent = "";

  task.options.forEach(function (option, index) {
    const button = document.createElement("button");
    button.className = "answer";
    button.type = "button";
    button.textContent = option;
    button.addEventListener("click", function () {
      checkAnswer(index, button);
    });
    answers.append(button);
    answerButtons.push(button);
  });

  clearFeedback();
}

function checkAnswer(index, button) {
  const task = TASKS[taskIndex];

  if (index === task.correct_index) {
    button.classList.add("is-correct");
    disableAnswers();

    if (attempts === 0) {
      points += POINTS_FIRST_TRY;
      firstTryCount++;
    } else {
      points += POINTS_LATER;
    }

    showCorrect(task);
    return;
  }

  // Неверный вариант гасим, но верный НЕ подсвечиваем и не называем.
  // Остальные кнопки живые: ученик пробует дальше.
  button.classList.add("is-wrong");
  button.disabled = true;
  attempts++;
  showWrong(task);
}

function disableAnswers() {
  answerButtons.forEach(function (button) {
    button.disabled = true;
  });
}

function clearFeedback() {
  const feedback = document.getElementById("task-feedback");
  feedback.textContent = "";
  feedback.className = "";
}

// Заголовок и текст внутри блока разбора — одинаковые у всех состояний.
function fillFeedback(feedback, titleText, bodyText) {
  const title = document.createElement("p");
  title.className = "feedback-title";
  title.textContent = titleText;

  const body = document.createElement("p");
  body.className = "feedback-text";
  body.textContent = bodyText;

  feedback.append(title, body);
}

// Кнопка перехода к следующему заданию (или к итогу, если это было последнее).
function createNextButton() {
  const button = document.createElement("button");
  button.className = "button button-primary";
  button.type = "button";
  if (taskIndex === TASKS.length - 1) {
    button.textContent = "Посмотреть итог";
  } else {
    button.textContent = "Следующее задание";
  }
  button.addEventListener("click", nextTask);
  return button;
}

// Верный ответ: короткое объяснение и ссылка на параграф.
function showCorrect(task) {
  const feedback = document.getElementById("task-feedback");
  feedback.textContent = "";
  feedback.className = "task-feedback is-ok";

  fillFeedback(feedback, "Верно", task.explanation);
  feedback.append(createSourceBadge());

  const actions = document.createElement("div");
  actions.className = "feedback-actions";
  actions.append(createNextButton());
  feedback.append(actions);
}

// Неверный ответ: подсказка и предложение разобрать задачу с наставником.
// Верного варианта здесь нет и быть не может.
function showWrong(task) {
  const feedback = document.getElementById("task-feedback");
  feedback.textContent = "";
  feedback.className = "task-feedback is-bad";

  fillFeedback(feedback, "Пока не то. Попробуй ещё раз", task.hint);

  const actions = document.createElement("div");
  actions.className = "feedback-actions";

  // Главное действие после ошибки: не подсмотреть, а разобраться.
  // Чат открывается сразу в режиме наставника.
  const mentorLink = document.createElement("a");
  mentorLink.className = "button button-primary";
  mentorLink.href = "chat.html?mode=mentor";
  mentorLink.textContent = "Помоги решить самому";
  actions.append(mentorLink);

  // Показать ответ — только после трёх неудачных попыток и только тихой
  // ссылкой сбоку. Раньше её нет вообще.
  if (attempts >= ATTEMPTS_BEFORE_REVEAL) {
    const revealLink = document.createElement("button");
    revealLink.className = "link-button";
    revealLink.type = "button";
    revealLink.textContent = "Показать ответ";
    revealLink.addEventListener("click", revealAnswer);
    actions.append(revealLink);
  }

  feedback.append(actions);
}

// Ученик попросил показать ответ. Очков за это задание не даём.
function revealAnswer() {
  const task = TASKS[taskIndex];

  answerButtons[task.correct_index].classList.add("is-correct");
  disableAnswers();

  const feedback = document.getElementById("task-feedback");
  feedback.textContent = "";
  feedback.className = "task-feedback";

  fillFeedback(feedback, "Верный ответ: " + task.options[task.correct_index],
    task.explanation);

  const note = document.createElement("p");
  note.className = "feedback-note";
  note.textContent = "Очки за это задание не начислены — в следующий раз дойди сам.";
  feedback.append(note);

  feedback.append(createSourceBadge());

  const actions = document.createElement("div");
  actions.className = "feedback-actions";
  actions.append(createNextButton());
  feedback.append(actions);
}

// --- Переход дальше и итог ---------------------------------------------------

function nextTask() {
  taskIndex++;
  if (taskIndex >= TASKS.length) {
    showSummary();
    return;
  }
  renderTask();
}

function showSummary() {
  document.getElementById("tasks").classList.add("is-hidden");
  document.getElementById("summary").classList.remove("is-hidden");

  // Очки всегда кратны пяти, поэтому слово всегда «очков» —
  // разбирать окончания не нужно.
  document.getElementById("summary-text").textContent =
    "Задания закончились. Ты набрал " + points + " очков.";
  document.getElementById("summary-detail").textContent =
    "С первой попытки: " + firstTryCount + " из " + TASKS.length;
}

// Запускаем в самом низу файла: константы выше объявлены через const,
// а до них добраться нужно раньше, чем ими воспользуются.
if (typeof MOCK === "undefined") {
  document.querySelector(".topic-page").innerHTML =
    "<p class=\"dash-error\">Не удалось загрузить тему. Обновите страницу.</p>";
} else {
  startTopic();
}
