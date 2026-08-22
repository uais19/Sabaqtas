// diagnostic.js — экран диагностики.
// Показываем вопрос за вопросом и рисуем лесенку пройденных тем,
// пока бэкенд не ответит status: "finished" — то есть не найдёт корневой пробел.

// --- Состояние экрана. Держим в одном месте, чтобы было видно, что меняется. ---
let diagnosticId = null;      // id диагностики, его выдаёт бэкенд
let currentQuestion = null;   // вопрос, который сейчас на экране
let isWaiting = false;        // пока показываем «верно/неверно», нажатия игнорируем
let currentRow = null;        // строка лесенки темы, которую сейчас проверяем

// --- Элементы страницы ---
const stateQuestion = document.getElementById("state-question");
const stateResult = document.getElementById("state-result");
const questionTopic = document.getElementById("question-topic");
const questionText = document.getElementById("question-text");
const answersBox = document.getElementById("answers");
const chainTitle = document.getElementById("chain-title");
const chainBox = document.getElementById("chain");
const resultTitle = document.querySelector("#state-result .page-title");
const resultChainBox = document.getElementById("result-chain");
const resultText = document.getElementById("result-text");
const resultSource = document.getElementById("result-source");
const errorBox = document.getElementById("error");

// --- Строка из анкеты ---
// Диагностика всегда стартует с верхней темы цепочки и спускается вниз,
// в каком бы классе ни был ученик. Строка с именем говорит это прямо, чтобы
// вопрос за младший класс не выглядел ошибкой. Конкретный класс здесь не
// называем: для семиклассника и одиннадцатиклассника он разный.
// Профиля может не быть (страницу открыли по прямой ссылке) — тогда
// строка просто остаётся скрытой.
const profile = readProfile();
if (profile && profile.name) {
  const profileLine = document.getElementById("profile-line");
  profileLine.textContent = profile.name + ", начинаем сверху и спускаемся, пока не найдём пробел";
  profileLine.classList.remove("is-hidden");
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

// Пауза на нужное число миллисекунд. Нужна, чтобы ученик успел увидеть,
// верно он ответил или нет, прежде чем появится следующий вопрос.
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Лесенка -------------------------------------------------------------

// Одна строка лесенки: тема слева, класс посередине, отметка справа.
// topic.is_correct: true/false — тема пройдена/провалена; null — тема ещё
// проверяется (первый ответ верный, впереди второй вопрос), отметки пока нет.
// isRoot — это и есть найденный корневой пробел, его выделяем золотым.
function createStairRow(topic, isRoot) {
  const row = document.createElement("li");
  row.className = "stair";
  if (isRoot) row.classList.add("stair-gap");

  const title = document.createElement("span");
  title.className = "stair-topic";
  title.textContent = topic.title;

  const grade = document.createElement("span");
  grade.className = "stair-grade";
  grade.textContent = topic.grade + " класс";

  const status = document.createElement("span");
  status.className = "stair-status";
  if (isRoot) status.textContent = "здесь пробел";
  else if (topic.is_correct === null) status.textContent = "ещё вопрос";
  else if (topic.is_correct) status.textContent = "✓ понятно";
  else status.textContent = "✕ не получилось";

  row.append(title, grade, status);
  return row;
}

// Строка темы в лесенке под вопросом. У темы ОДНА строка, сколько бы
// вопросов по ней ни задали: после первого ответа строка появляется,
// после второго — перерисовывается уже с итоговой отметкой.
function addChainRow(topic) {
  const row = createStairRow(topic, false);
  // Класс запускает короткое появление строки — ученик замечает, что она новая.
  row.classList.add("stair-appear");
  if (currentRow !== null) {
    currentRow.replaceWith(row); // тема уже в лесенке — обновляем её строку
  } else {
    chainBox.append(row);
  }
  currentRow = row;
  chainTitle.classList.remove("is-hidden");
}

// --- Вопрос --------------------------------------------------------------

// Рисуем вопрос и кнопки ответов.
function showQuestion(question) {
  currentQuestion = question;
  questionTopic.textContent = question.topic_title + " · " + question.grade + " класс";
  questionText.textContent = question.text;

  answersBox.textContent = ""; // убираем кнопки прошлого вопроса

  question.options.forEach((option) => {
    answersBox.append(createAnswerButton(option, false));
  });

  // Пятая кнопка есть всегда. Бэкенд засчитывает её как неверный ответ.
  answersBox.append(createAnswerButton("Не знаю", true));
}

// Кнопка одного варианта ответа.
function createAnswerButton(text, isDontKnow) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "answer";
  if (isDontKnow) button.classList.add("answer-dontknow");
  button.textContent = text;
  button.addEventListener("click", () => handleAnswer(text, button));
  return button;
}

// Ученик нажал на вариант ответа.
async function handleAnswer(answerText, button) {
  // Второе нажатие, пока показываем результат предыдущего, пропускаем.
  if (isWaiting) return;
  isWaiting = true;

  try {
    const reply = await sendDiagnosticAnswer(diagnosticId, currentQuestion.id, answerText);

    // Подсвечиваем нажатую кнопку: верный ответ зелёным, неверный красным.
    button.classList.add(reply.is_correct ? "is-correct" : "is-wrong");

    // Тема текущего вопроса — в лесенку. Пока тема не решена (topic_done:
    // false — первый ответ верный, впереди второй вопрос), отметки нет:
    // is_correct = null рисует «ещё вопрос». Решённая тема получает ✓ или ✕
    // по последнему ответу — он её судьбу и решил.
    addChainRow({
      title: currentQuestion.topic_title,
      grade: currentQuestion.grade,
      is_correct: reply.topic_done ? reply.is_correct : null
    });
    // Тема решена — следующий вопрос будет по другой теме, ей нужна своя строка.
    if (reply.topic_done) {
      currentRow = null;
    }

    await wait(600); // время, чтобы увидеть подсветку

    if (reply.status === "finished") showResult(reply.result);
    else showQuestion(reply.question);
  } catch (error) {
    showError();
  }

  isWaiting = false;
}

// --- Результат -----------------------------------------------------------

// Переключаемся на второе состояние страницы и рисуем итог.
function showResult(result) {
  stateQuestion.classList.add("is-hidden");
  stateResult.classList.remove("is-hidden");

  const root = result.root_topic;

  // Полная цепочка тем приходит с бэкенда — рисуем её заново,
  // выделяя ту тему, которая оказалась корневым пробелом.
  resultChainBox.textContent = "";
  result.path.forEach((topic) => {
    // Если пробела нет, root равен null и выделять нечего.
    const isRoot = root !== null && topic.topic_id === root.id;
    resultChainBox.append(createStairRow(topic, isRoot));
  });

  // Редкий случай: ученик сразу ответил верно, спускаться было некуда.
  if (root === null) {
    resultTitle.textContent = "Пробелов не нашли";
    resultText.textContent = "Ты уверенно держишь тему за свой класс. Начнём с текущей программы.";
    resultSource.textContent = "";
    return;
  }

  // Текст собираем из данных, а не пишем названия тем руками:
  // при другом пробеле страница должна говорить правду.
  resultTitle.textContent = "Нашли, где ты застрял";
  const firstTopic = result.path[0];
  const tail = ' за ' + root.grade + ' класс. Пока не закроем её, остальное решать бесполезно.';

  if (root.id === firstTopic.topic_id) {
    // Пробел оказался на самой первой теме — противопоставлять нечему.
    resultText.textContent = 'Начинаем с темы "' + root.title + '"' + tail;
  } else {
    resultText.textContent =
      'Начинаем не с темы "' + firstTopic.title + '", а с темы "' + root.title + '"' + tail;
  }

  // Сверяем самооценку из анкеты с тем, что нашла диагностика — ради этого
  // уровень и спрашивали. Уровня может не быть (профиля нет или он сохранён
  // до появления поля) — тогда предложения просто не будет.
  const level = profile ? levelLabel(profile.level) : "";
  if (level) {
    resultText.textContent +=
      ' Ты оценил подготовку как «' + level + '», а пробел оказался за ' + root.grade + ' класс.';
  }

  resultSource.textContent = "источник — " + paragraphOnly(root.source_ref);
}

// --- Запуск и перезапуск -------------------------------------------------

function showError() {
  errorBox.textContent = "Не удалось загрузить вопрос. Обнови страницу и попробуй ещё раз.";
  errorBox.classList.remove("is-hidden");
}

// Начинаем диагностику: спрашиваем у бэкенда первый вопрос.
async function start() {
  errorBox.classList.add("is-hidden");
  chainBox.textContent = "";
  currentRow = null;
  chainTitle.classList.add("is-hidden");
  stateResult.classList.add("is-hidden");
  stateQuestion.classList.remove("is-hidden");

  try {
    const data = await startDiagnostic("math", 9);
    diagnosticId = data.diagnostic_id;
    showQuestion(data.question);
  } catch (error) {
    showError();
  }
}

// «Пройти заново» — то же самое, что открыть страницу заново.
document.getElementById("restart").addEventListener("click", start);

start();
