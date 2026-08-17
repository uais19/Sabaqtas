// api.js — единственное место, откуда фронтенд ходит за данными.
// Пока USE_MOCK = true, все функции возвращают данные из mock.js.
// Когда бэкенд будет готов: ставим USE_MOCK = false, прописываем API_BASE_URL,
// и остальной код менять не придётся.
//
// Файл подключается после mock.js, поэтому объект MOCK здесь уже доступен.

const USE_MOCK = true;
const API_BASE_URL = "";

// Номер текущего шага диагностики.
// Нужен только для моков: по нему берём следующий ответ из MOCK.diagnosticAnswer.
let mockDiagnosticStep = 0;

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
    mockDiagnosticStep = 0;
    return MOCK.diagnosticStart;
  }
  return await request("POST", "/api/diagnostic/start", { subject: subject, grade: grade });
}

// Отправить ответ ученика на вопрос диагностики.
// Возвращает либо следующий вопрос (status: "continue"),
// либо итог с корневым пробелом (status: "finished").
async function sendDiagnosticAnswer(diagnosticId, questionId, answer) {
  if (USE_MOCK) {
    const reply = MOCK.diagnosticAnswer[mockDiagnosticStep];
    mockDiagnosticStep = mockDiagnosticStep + 1;
    return reply;
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
