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
// mockPath — что ученик уже ответил; из этого списка собирается итог.
let mockLevel = 0;
let mockPath = [];

// Готовим вопрос для страницы. correct_index сюда не попадает:
// настоящий бэкенд не присылает правильный ответ во фронтенд.
function mockQuestion(level) {
  return {
    id: level.question.id,
    text: level.question.text,
    options: level.question.options,
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
    // null означает, что пробелов не нашли: ученик ответил верно сразу.
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
    mockLevel = 0;
    mockPath = [];
    return {
      diagnostic_id: "diag_1001",
      question: mockQuestion(MOCK.diagnosticChain[0])
    };
  }
  return await request("POST", "/api/diagnostic/start", { subject: subject, grade: grade });
}

// Отправить ответ ученика на вопрос диагностики.
// Возвращает либо следующий вопрос (status: "continue"),
// либо итог с корневым пробелом (status: "finished").
async function sendDiagnosticAnswer(diagnosticId, questionId, answer) {
  if (USE_MOCK) {
    const level = MOCK.diagnosticChain[mockLevel];

    // Ответ приходит текстом варианта. indexOf находит его номер в options.
    // Для кнопки «Не знаю» такого варианта в списке нет, поэтому indexOf
    // вернёт −1 — это никогда не совпадёт с correct_index, то есть
    // «Не знаю» всегда считается неверным ответом.
    const chosenIndex = level.question.options.indexOf(answer);
    const isCorrect = chosenIndex === level.question.correct_index;

    mockPath.push({
      topic_id: level.topic_id,
      title: level.topic_title,
      grade: level.grade,
      is_correct: isCorrect
    });

    // Ответил верно — ниже спускаться незачем, диагностика окончена.
    if (isCorrect) {
      return { is_correct: true, status: "finished", result: mockResult() };
    }

    // Ошибся — спускаемся на тему ниже, если она в цепочке есть.
    const nextLevel = MOCK.diagnosticChain[mockLevel + 1];
    if (nextLevel) {
      mockLevel = mockLevel + 1;
      return { is_correct: false, status: "continue", question: mockQuestion(nextLevel) };
    }

    // Ниже тем не осталось: корневой пробел — самая нижняя проваленная тема.
    return { is_correct: false, status: "finished", result: mockResult() };
  }
  return await request("POST", "/api/diagnostic/answer", {
    diagnostic_id: diagnosticId,
    question_id: questionId,
    answer: answer
  });
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
