// ask.js — серверная функция Vercel: ответ ИИ строго по учебникам.
//
// Как это работает:
//   1. вопрос ученика превращаем в вектор (эмбеддинг)
//   2. сравниваем его с готовыми векторами кусков учебника из chunks.json
//   3. если даже лучший кусок недостаточно похож — честно отвечаем,
//      что в учебниках этого нет, и модель ВООБЩЕ не вызываем
//   4. иначе собираем инструкцию с найденными кусками и просим модель ответить
//
// Ключ Gemini живёт в переменной окружения GEMINI_API_KEY на сервере.
// В коде и в ответах функции его нет и быть не должно.

const fs = require("fs");
const path = require("path");
const prompts = require("./prompts.js");

// --- Константы ---------------------------------------------------------------

// Порог похожести вопроса на кусок учебника (от -1 до 1).
// Ниже порога — отвечаем «этого нет в учебниках» и НЕ вызываем модель.
// Это гарантия в коде, а не просьба к модели: модель можно уговорить
// нарушить инструкцию, а это условие обойти нельзя.
const SIMILARITY_THRESHOLD = 0.6;

// Сколько лучших кусков учебника отдаём модели как контекст.
const TOP_COUNT = 5;

// Максимальная длина вопроса в символах.
const MAX_QUESTION_LENGTH = 1000;

// Модель, которая считает векторы.
const EMBED_MODEL = "gemini-embedding-2";

// Модели, которые пишут ответ.
// Дневная квота бесплатного тарифа считается ОТДЕЛЬНО для каждой модели:
// у одной может быть 26 запросов из 20, а у соседней ноль. Поэтому здесь
// не одна модель, а очередь запасных — как только у текущей кончился
// лимит, тот же запрос уходит к следующей. Порядок — от лучшей к простой.
const GENERATION_MODELS = [
  "gemini-3.5-flash",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

const OUTPUT_DIMENSIONALITY = 768; // такой же размер, как в chunks.json

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

// --- База знаний -------------------------------------------------------------

// chunks.json читаем ОДИН раз при загрузке модуля, а не на каждый запрос:
// «тёплые» вызовы функции переиспользуют уже загруженные данные.
let CHUNKS = [];
try {
  CHUNKS = JSON.parse(
    fs.readFileSync(path.join(__dirname, "chunks.json"), "utf-8")
  );
} catch (error) {
  // Файла нет или он битый. Запоминаем пустой список — функция ответит
  // «не найдено», а причина будет видна в логах сервера.
  console.error("Не удалось загрузить chunks.json: " + error.message);
}

// --- Кэш ответов -------------------------------------------------------------

// Кэш экономит дневную квоту и делает демо устойчивым — на сцене повторный
// вопрос отвечается мгновенно и без обращения к API. Бесплатный тариф даёт
// всего 20 генераций в день на каждую модель, поэтому каждый сэкономленный
// запрос на счету.
//
// Map лежит вне обработчика — на уровне модуля. Vercel переиспользует
// «тёплый» процесс между вызовами, поэтому кэш живёт от запроса к запросу
// и работает сразу на всех: если один зритель спросил про дроби, второй
// получит ответ мгновенно. Холодный старт кэш обнуляет, и это нормально:
// это ускорение, а не хранилище, терять тут нечего.
const ANSWER_CACHE = new Map();

// Сколько ответов держим. Больше не нужно: демо столько не наспрашивает,
// а память функции не резиновая.
const CACHE_LIMIT = 200;

// Ключ — всё, что меняет ответ: сам вопрос, режим, язык и класс.
// Вопрос приводим к нижнему регистру и обрезаем пробелы, чтобы
// «Что такое дробь?» и «что такое дробь? » считались одним вопросом.
function cacheKey(question, mode, lang, grade) {
  return question.trim().toLowerCase() + "|" + mode + "|" + lang + "|" + grade;
}

// Кладём ответ в кэш и выбрасываем самые старые, если их стало слишком много.
function saveToCache(key, payload) {
  ANSWER_CACHE.set(key, payload);
  // Map помнит порядок добавления, поэтому первый ключ — самый старый.
  while (ANSWER_CACHE.size > CACHE_LIMIT) {
    const oldest = ANSWER_CACHE.keys().next().value;
    ANSWER_CACHE.delete(oldest);
  }
}

// --- Работа с векторами ------------------------------------------------------

// Приводим вектор к длине 1. Векторы в chunks.json уже нормированы,
// поэтому после этого сравнивать их можно простым скалярным произведением.
function normalize(vector) {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  const length = Math.sqrt(sum);
  return vector.map(function (value) {
    return value / length;
  });
}

// Скалярное произведение: перемножаем числа попарно и складываем.
// Для векторов длины 1 это и есть косинусная похожесть.
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// --- Запросы к Gemini ----------------------------------------------------------

// Паузы перед второй и третьей попытками, в миллисекундах.
const RETRY_DELAYS = [1000, 3000];

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// Похоже ли это на исчерпанный лимит. Gemini отдаёт его кодом 429,
// а в теле ответа пишет RESOURCE_EXHAUSTED или слово quota.
function isQuotaError(status, details) {
  if (status === 429) {
    return true;
  }
  const lower = details.toLowerCase();
  return lower.includes("resource_exhausted") || lower.includes("quota");
}

// Один запрос к Gemini с повторами.
// Бесплатный тариф Gemini ограничивает частоту запросов, поэтому повтор
// с паузой обязателен — иначе на демо будет случайный сбой: каждый вопрос
// делает два вызова (эмбеддинг и генерация), и пять вопросов подряд
// упираются в лимит.
//
// Повторяем только 429 (слишком часто) и 5xx (сбой на стороне Gemini).
// 400/401/403/404 — настоящие ошибки, повтор их не вылечит: бросаем сразу.
// Если все попытки кончились, бросаем ошибку с пометкой isOverload —
// обработчик по ней вернёт ученику понятный ответ 503.
//
// retryOn429 = false означает «не трать попытки на лимит, брось ошибку
// с пометкой isQuota сразу». Так делает генерация: у неё есть запасные
// модели, а дневная квота за три секунды всё равно не восстановится.
// Эмбеддингу менять нечего, поэтому он передаёт true и ждёт, как раньше.
async function fetchGemini(url, payload, apiKey, label, retryOn429) {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= RETRY_DELAYS.length + 1; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return response;
    }

    // Тело ошибки нужно дважды: понять, лимит это или нет, и написать
    // внятную причину в лог сервера.
    const details = await response.text();

    // Лимит кончился, а повторять нам не разрешили — пусть вызывающий код
    // сам решает, что делать дальше (генерация возьмёт следующую модель).
    if (isQuotaError(response.status, details) && !retryOn429) {
      const quota = new Error(label + ": лимит исчерпан (код " + response.status + ")");
      quota.isQuota = true;
      throw quota;
    }

    if (response.status !== 429 && response.status < 500) {
      const failure = new Error(label + ": Gemini ответил кодом " + response.status +
        ", " + details.slice(0, 200));
      failure.status = response.status;
      throw failure;
    }

    lastStatus = response.status;
    if (attempt <= RETRY_DELAYS.length) {
      console.error(label + ": код " + lastStatus + ", повтор через " +
        RETRY_DELAYS[attempt - 1] + " мс (попытка " + (attempt + 1) + " из " +
        (RETRY_DELAYS.length + 1) + ")");
      await wait(RETRY_DELAYS[attempt - 1]);
    }
  }

  const overload = new Error(label + ": Gemini перегружен, последний код " + lastStatus);
  overload.isOverload = true;
  throw overload;
}

// Вектор для вопроса ученика.
// Последний аргумент true: запасной модели для векторов нет, поэтому
// лимит частоты пережидаем повтором с паузой.
async function embedQuestion(question, apiKey) {
  const response = await fetchGemini(API_BASE + EMBED_MODEL + ":embedContent", {
    model: "models/" + EMBED_MODEL,
    content: { parts: [{ text: question }] },
    // RETRIEVAL_QUERY — это вопрос, которым ищут; куски учебника
    // считались с парным типом RETRIEVAL_DOCUMENT.
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: OUTPUT_DIMENSIONALITY
  }, apiKey, "эмбеддинг", true);

  const data = await response.json();
  return normalize(data.embedding.values);
}

// Ответ генеративной модели.
// contents — история разговора в формате Gemini, system — инструкция.
//
// Идём по списку моделей сверху вниз и переходим к следующей, если:
//   * кончился лимит (429) — у следующей модели свой счётчик;
//   * модель ответила 404 — такого имени у Gemini нет. Опечатка в названии
//     не должна ронять всю функцию, просто пробуем дальше.
// Остальные ошибки сменой модели не лечатся, их бросаем наверх.
//
// Возвращаем и текст, и имя модели, которая реально ответила.
async function generateAnswer(system, contents, apiKey) {
  for (let i = 0; i < GENERATION_MODELS.length; i++) {
    const model = GENERATION_MODELS[i];

    try {
      // Последний аргумент false: на лимит не тратим повторы с паузой —
      // ниже по списку есть другие модели, они быстрее.
      const response = await fetchGemini(API_BASE + model + ":generateContent", {
        systemInstruction: { parts: [{ text: system }] },
        contents: contents,
        // Низкая температура: меньше выдумки, ответы ближе к тексту учебника.
        generationConfig: { temperature: 0.2 }
      }, apiKey, "генерация (" + model + ")", false);

      const data = await response.json();
      const candidate = data.candidates && data.candidates[0];
      const part = candidate && candidate.content && candidate.content.parts &&
        candidate.content.parts[0];
      if (!part || typeof part.text !== "string") {
        throw new Error("генерация: в ответе Gemini нет текста");
      }

      console.log("Ответила модель " + model);
      return { text: part.text, model: model };
    } catch (error) {
      // Лимит или несуществующее имя модели — берём следующую из списка.
      if (error.isQuota || error.status === 404) {
        console.error("Модель " + model + " не подошла: " + error.message +
          ". Пробуем следующую.");
        continue;
      }
      throw error;
    }
  }

  // Список кончился: ни одна модель не ответила.
  const exhausted = new Error("генерация: лимит кончился у всех моделей списка");
  exhausted.isQuotaExhausted = true;
  throw exhausted;
}

// --- Чистка ответа -------------------------------------------------------------

// Убираем LaTeX, если модель всё-таки его написала: инструкции инструкциями,
// а модели иногда их игнорируют. Дешёвая страховка на выходе.
function stripLatex(text) {
  return text
    // \frac{a}{b} -> a/b
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    // \sqrt{x} -> √x
    .replace(/\\sqrt\{([^{}]*)\}/g, "√$1")
    // знаки доллара, которыми LaTeX обрамляет формулы
    .replace(/\$/g, "");
}

// --- История разговора ---------------------------------------------------------

// Переводим историю из формата фронтенда в формат Gemini.
// Роль ученика — "user", всё остальное считаем ответами модели.
function historyToContents(history) {
  if (!Array.isArray(history)) {
    return [];
  }
  return history
    .filter(function (message) {
      return message && typeof message.text === "string" && message.text !== "";
    })
    .map(function (message) {
      return {
        role: message.role === "user" ? "user" : "model",
        parts: [{ text: message.text }]
      };
    });
}

// --- Обработчик запроса ----------------------------------------------------------

module.exports = async function handler(req, res) {
  // Функция принимает только POST с JSON.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Только POST" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Ключ не настроен на сервере. Наружу причину не раскрываем.
    console.error("Не задана переменная окружения GEMINI_API_KEY");
    return res.status(500).json({ error: "Сервис не настроен" });
  }

  // Vercel сам разбирает JSON-тело в req.body.
  const body = req.body || {};
  const question = body.question;
  const mode = body.mode === "mentor" ? "mentor" : "explain";
  const lang = body.lang === "kk" ? "kk" : "ru";
  const grade = Number(body.grade) || 9;

  // То же правило, что и на клиенте: кэшируем только первую реплику
  // диалога. Дальше ответ зависит от истории, а её в ключе нет.
  const history = body.history;
  const cacheable = !Array.isArray(history) || history.length === 0;

  // Проверяем вопрос: непустая строка не длиннее 1000 символов.
  if (typeof question !== "string" || question.trim() === "") {
    return res.status(400).json({ error: "Поле question должно быть непустой строкой" });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({
      error: "Вопрос длиннее " + MAX_QUESTION_LENGTH + " символов"
    });
  }

  // Шаг 0: кэш. Если такой вопрос уже отвечали, отдаём готовый ответ
  // и не трогаем Gemini вообще — ни эмбеддинг, ни генерацию.
  const key = cacheKey(question, mode, lang, grade);
  const cached = cacheable ? ANSWER_CACHE.get(key) : undefined;
  if (cached) {
    console.log("Ответ из кэша: " + key);
    return res.status(200).json(cached);
  }

  try {
    // Шаг 1: вопрос -> вектор.
    const questionVector = await embedQuestion(question.trim(), apiKey);

    // Шаг 2: похожесть вопроса на каждый кусок учебника.
    const scored = CHUNKS.map(function (chunk) {
      return { chunk: chunk, score: dotProduct(questionVector, chunk.embedding) };
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });

    const top = scored.slice(0, TOP_COUNT);
    const topScore = top.length > 0 ? top[0].score : 0;

    // Шаг 3: порог. Лучший кусок слишком не похож на вопрос — значит
    // в учебниках ответа нет. Модель не вызываем вовсе:
    // это гарантия в коде, а не просьба к модели.
    if (topScore < SIMILARITY_THRESHOLD) {
      // Это настоящий результат, а не сбой: кэшируем наравне с ответом.
      const missing = {
        answer: "Этого нет в загруженных учебниках.",
        found: false,
        topScore: Number(topScore.toFixed(3)),
        sources: []
      };
      saveToCache(key, missing);
      return res.status(200).json(missing);
    }

    // Для ответа берём только куски, прошедшие порог.
    const passed = top.filter(function (item) {
      return item.score >= SIMILARITY_THRESHOLD;
    });
    const contextChunks = passed.map(function (item) {
      return item.chunk;
    });

    // Шаг 4: инструкция для нужного режима + история разговора.
    let system;
    const contents = historyToContents(body.history);
    if (mode === "mentor") {
      system = prompts.mentorPrompt(lang, grade, contextChunks);
    } else {
      system = prompts.explainPrompt(lang, grade, contextChunks, question.trim());
    }
    // Текущий вопрос — последняя реплика ученика.
    contents.push({ role: "user", parts: [{ text: question.trim() }] });

    // Шаг 5: ответ модели + чистка от LaTeX.
    const generated = await generateAnswer(system, contents, apiKey);
    const answer = stripLatex(generated.text).trim();

    // Порог отсекает по похожести, но модель имеет независимое право
    // отказаться: фрагменты могут быть близки по теме, а ответа на сам
    // вопрос в них нет. Оба сигнала должны совпадать. Если в тексте отказ,
    // то found = false и без источников — иначе интерфейс покажет плашку
    // источника под ответом «этого нет в учебниках», что выглядит как ошибка.
    // Проверяем обе фразы отказа: «объясни» и «наставник» говорят по-разному.
    const lowerAnswer = answer.toLowerCase();
    if (lowerAnswer.includes("нет в загруженных учебниках") ||
        lowerAnswer.includes("загруженных материалах этой темы нет")) {
      const refusal = {
        answer: answer,
        found: false,
        topScore: Number(topScore.toFixed(3)),
        sources: [],
        model: generated.model
      };
      if (cacheable) {
        saveToCache(key, refusal);
      }
      return res.status(200).json(refusal);
    }

    // Источники: из каких мест учебника собран ответ.
    const sources = passed.map(function (item) {
      return {
        book: item.chunk.subject + ", " + item.chunk.grade + " класс",
        grade: item.chunk.grade,
        part: item.chunk.part,
        paragraph: item.chunk.paragraph,
        page: item.chunk.page,
        // Короткий кусочек текста, чтобы показать источник в интерфейсе.
        snippet: item.chunk.text.slice(0, 160)
      };
    });

    const payload = {
      answer: answer,
      found: true,
      topScore: Number(topScore.toFixed(3)),
      sources: sources,
      // Какая модель ответила. Нужно нам для консоли, ученику не показываем.
      model: generated.model
    };

    // В кэш попадают только состоявшиеся ответы. Сбои, ошибки квоты и
    // отказы из-за ошибок сюда не доходят — они уходят в catch ниже.
    if (cacheable) {
      saveToCache(key, payload);
    }
    return res.status(200).json(payload);
  } catch (error) {
    // Логируем причину на сервере, наружу отдаём общий текст без деталей:
    // сырая ошибка Gemini не должна доходить до клиента.
    console.error("Ошибка ask.js: " + error.message);

    // Дневной лимит кончился у всех моделей списка. До завтра он не оживёт,
    // поэтому не обещаем «подожди пару секунд».
    if (error.isQuotaExhausted) {
      return res.status(503).json({
        error: "Дневной лимит запросов исчерпан. Попробуй завтра."
      });
    }

    // Все попытки упёрлись в лимит частоты — это временно, так и говорим.
    if (error.isOverload) {
      return res.status(503).json({
        error: "Слишком много запросов. Подожди пару секунд и спроси снова."
      });
    }

    return res.status(502).json({ error: "Не удалось получить ответ. Попробуйте ещё раз." });
  }
};
