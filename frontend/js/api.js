// api.js — единственное место, откуда фронтенд ходит за данными.
// Пока USE_MOCK = true, все функции возвращают данные из mock.js.
// Когда бэкенд будет готов: ставим USE_MOCK = false, прописываем API_BASE_URL,
// и остальной код менять не придётся.
//
// Файл подключается после mock.js, поэтому объект MOCK здесь уже доступен.

const USE_MOCK = true;
const API_BASE_URL = "";

// Состояние моковой диагностики.
// mockLevel — на какой ступени цепочки MOCK.diagnosticChain мы сейчас.
// mockQuestionIndex — какой вопрос этой темы задаём: 0 — первый, 1 — второй.
// mockPassedInRow — сколько тем подряд пройдено; дошло до двух — стоп.
// mockPath — чем закончилась каждая проверенная тема. ОДНА запись на тему,
// а не на вопрос: из этого списка собирается итог и лесенка на экране.
let mockLevel = 0;
let mockQuestionIndex = 0;
let mockPassedInRow = 0;
let mockPath = [];

// Правило спуска.
// Тема ПРОЙДЕНА, когда верны оба её вопроса. Тема ПРОВАЛЕНА, как только
// неверен любой из них: после ошибки в первом вопросе второй не задаём —
// подтверждение провала стоит вопроса, а нового не говорит ничего.
// Спуск останавливается, когда пройдены ДВЕ ТЕМЫ ПОДРЯД или цепочка
// кончилась. Одной пройденной темы нарочно мало: знания бывают лоскутными —
// на одном уровне всё хорошо, уровнем ниже дыра. Одна удачная тема (тем
// более один удачный ответ) не должна закрывать диагностику.
const PASSES_TO_STOP = 2;

// Вопросы темы. Берём questions, если это непустой массив; иначе — старое
// одиночное поле question, завёрнутое в массив.
function questionsOf(level) {
  if (Array.isArray(level.questions) && level.questions.length > 0) {
    return level.questions;
  }
  return [level.question];
}

// Готовим вопрос для страницы. correct_index сюда не попадает:
// настоящий бэкенд не присылает правильный ответ во фронтенд.
function mockQuestion(level, index) {
  const question = questionsOf(level)[index];
  return {
    id: question.id,
    text: question.text,
    options: question.options,
    topic_title: level.topic_title,
    grade: level.grade
  };
}

// Итог диагностики. Корневой пробел — последняя тема, где ученик ошибся:
// мы спускаемся сверху вниз, значит она же и самая нижняя из проваленных.
function mockResult() {
  const failed = mockPath.filter((step) => step.is_correct === false);

  let rootTopic = null;
  if (failed.length > 0) {
    const lastFailed = failed[failed.length - 1];
    const level = MOCK.diagnosticChain.find((item) => item.topic_id === lastFailed.topic_id);
    rootTopic = {
      id: level.topic_id,
      title: level.topic_title,
      grade: level.grade,
      source_ref: level.source_ref
    };
  }

  return {
    // null означает, что пробелов не нашли: ни одна проверенная тема не провалена.
    root_topic: rootTopic,
    // Реальный путь: какие темы проверили и чем каждая закончилась.
    path: mockPath,
    // Слабые темы: сначала самая нижняя, потом те, что выше неё.
    weak_topics: failed.slice().reverse().map((step) => ({
      topic_id: step.topic_id,
      title: step.title,
      grade: step.grade
    }))
  };
}

// Запоминаем итог в localStorage (saveDiagnostic в profile.js), чтобы другие
// экраны знали, чем кончилась диагностика. Пока это никто не читает —
// кабинет подключится следующим шагом.
// failed — id проваленных тем в порядке спуска, сверху вниз.
function rememberDiagnostic(result) {
  const failed = result.path
    .filter((step) => step.is_correct === false)
    .map((step) => step.topic_id);
  saveDiagnostic({
    root_topic_id: result.root_topic ? result.root_topic.id : null,
    failed: failed
  });
}

// Общая функция для запросов к бэкенду.
// method — "GET" или "POST", path — путь эндпоинта, body — тело запроса (или null).
async function request(method, path, body) {
  const options = {
    method: method,
    headers: { "Content-Type": "application/json" }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(API_BASE_URL + path, options);

  if (!response.ok) {
    throw new Error("Ошибка запроса: " + response.status);
  }

  return await response.json();
}

// Начать диагностику по предмету. Возвращает id диагностики и первый вопрос.
async function startDiagnostic(subject, grade) {
  if (USE_MOCK) {
    // Всё состояние прошлого прохода сбрасываем здесь, в одном месте:
    // «Пройти заново» должно начинать с чистого листа.
    mockLevel = 0;
    mockQuestionIndex = 0;
    mockPassedInRow = 0;
    mockPath = [];
    return {
      diagnostic_id: "diag_1001",
      question: mockQuestion(MOCK.diagnosticChain[0], 0)
    };
  }
  return await request("POST", "/api/diagnostic/start", { subject: subject, grade: grade });
}

// Отправить ответ ученика на вопрос диагностики.
// Возвращает либо следующий вопрос (status: "continue"),
// либо итог с корневым пробелом (status: "finished").
// В ответе есть topic_done: true — тема решена (пройдена или провалена),
// и экран ставит ей отметку в лесенке; false — тема ещё проверяется:
// первый ответ верный, следующий вопрос — по той же теме.
async function sendDiagnosticAnswer(diagnosticId, questionId, answer) {
  if (USE_MOCK) {
    const level = MOCK.diagnosticChain[mockLevel];
    const question = questionsOf(level)[mockQuestionIndex];

    // Ответ приходит текстом варианта. indexOf находит его номер в options.
    // Для кнопки «Не знаю» такого варианта в списке нет, поэтому indexOf
    // вернёт −1 — это никогда не совпадёт с correct_index, то есть
    // «Не знаю» всегда считается неверным ответом.
    const chosenIndex = question.options.indexOf(answer);
    const isCorrect = chosenIndex === question.correct_index;

    // Верно, и у темы остался ещё вопрос — задаём его. Тема пока не решена:
    // один верный ответ может быть удачей.
    if (isCorrect && mockQuestionIndex + 1 < questionsOf(level).length) {
      mockQuestionIndex = mockQuestionIndex + 1;
      return {
        is_correct: true,
        topic_done: false,
        status: "continue",
        question: mockQuestion(level, mockQuestionIndex)
      };
    }

    // Тема решена: ошибка — провалена, верный последний ответ — пройдена.
    mockPath.push({
      topic_id: level.topic_id,
      title: level.topic_title,
      grade: level.grade,
      is_correct: isCorrect
    });
    if (isCorrect) {
      mockPassedInRow = mockPassedInRow + 1;
    } else {
      mockPassedInRow = 0; // провал обрывает серию: считаем пройденные ПОДРЯД
    }

    // Стоп: две темы подряд пройдены или ниже тем не осталось.
    // Корневой пробел — самая нижняя проваленная тема (см. mockResult).
    const nextLevel = MOCK.diagnosticChain[mockLevel + 1];
    if (mockPassedInRow >= PASSES_TO_STOP || !nextLevel) {
      const result = mockResult();
      rememberDiagnostic(result);
      return { is_correct: isCorrect, topic_done: true, status: "finished", result: result };
    }

    // Иначе спускаемся на тему ниже и начинаем её с первого вопроса.
    mockLevel = mockLevel + 1;
    mockQuestionIndex = 0;
    return {
      is_correct: isCorrect,
      topic_done: true,
      status: "continue",
      question: mockQuestion(nextLevel, 0)
    };
  }

  const reply = await request("POST", "/api/diagnostic/answer", {
    diagnostic_id: diagnosticId,
    question_id: questionId,
    answer: answer
  });
  // Итог настоящего бэкенда запоминаем так же, как моковый.
  if (reply.status === "finished") {
    rememberDiagnostic(reply.result);
  }
  return reply;
}

// Получить план обучения — список тем, начиная с корневого пробела.
async function getPlan(studentId) {
  if (USE_MOCK) {
    return MOCK.plan;
  }
  return await request("GET", "/api/plan/" + studentId, null);
}

// Получить прогресс ученика для дашборда.
async function getProgress(studentId) {
  if (USE_MOCK) {
    return MOCK.progress;
  }
  return await request("GET", "/api/progress/" + studentId, null);
}

// Обычный вопрос к ИИ: ответ строго по учебникам, со ссылками на источник.
// language — "ru" или "kk".
async function ask(question, language) {
  if (USE_MOCK) {
    if (language === "kk") {
      return MOCK.askKazakh;
    }
    return MOCK.askExplain;
  }
  return await request("POST", "/api/ask", { question: question, language: language });
}

// Сообщение в режиме наставника: ИИ отвечает наводящим вопросом, а не решением.
async function sendMentorMessage(taskId, message) {
  if (USE_MOCK) {
    return MOCK.mentorReply;
  }
  return await request("POST", "/api/mentor/reply", { task_id: taskId, message: message });
}

// Список учеников класса для панели учителя.
async function getTeacherStudents(classId) {
  if (USE_MOCK) {
    return MOCK.teacherStudents;
  }
  return await request("GET", "/api/teacher/students/" + classId, null);
}

// Статистика класса по темам для панели учителя.
async function getTeacherClassStats(classId) {
  if (USE_MOCK) {
    return MOCK.teacherClassStats;
  }
  return await request("GET", "/api/teacher/stats/" + classId, null);
}
