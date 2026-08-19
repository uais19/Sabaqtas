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

// Модели Gemini: одна считает векторы, другая пишет ответ.
const EMBED_MODEL = "gemini-embedding-2";
const GENERATE_MODEL = "gemini-3.5-flash";
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

// Вектор для вопроса ученика.
async function embedQuestion(question, apiKey) {
  const response = await fetch(API_BASE + EMBED_MODEL + ":embedContent", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/" + EMBED_MODEL,
      content: { parts: [{ text: question }] },
      // RETRIEVAL_QUERY — это вопрос, которым ищут; куски учебника
      // считались с парным типом RETRIEVAL_DOCUMENT.
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: OUTPUT_DIMENSIONALITY
    })
  });

  if (!response.ok) {
    throw new Error("эмбеддинг: Gemini ответил кодом " + response.status);
  }

  const data = await response.json();
  return normalize(data.embedding.values);
}

// Ответ генеративной модели.
// contents — история разговора в формате Gemini, system — инструкция.
async function generateAnswer(system, contents, apiKey) {
  const response = await fetch(API_BASE + GENERATE_MODEL + ":generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: contents,
      // Низкая температура: меньше выдумки, ответы ближе к тексту учебника.
      generationConfig: { temperature: 0.2 }
    })
  });

  if (!response.ok) {
    throw new Error("генерация: Gemini ответил кодом " + response.status);
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  const part = candidate && candidate.content && candidate.content.parts &&
    candidate.content.parts[0];
  if (!part || typeof part.text !== "string") {
    throw new Error("генерация: в ответе Gemini нет текста");
  }
  return part.text;
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

  // Проверяем вопрос: непустая строка не длиннее 1000 символов.
  if (typeof question !== "string" || question.trim() === "") {
    return res.status(400).json({ error: "Поле question должно быть непустой строкой" });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({
      error: "Вопрос длиннее " + MAX_QUESTION_LENGTH + " символов"
    });
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
      return res.status(200).json({
        answer: "Этого нет в загруженных учебниках.",
        found: false,
        topScore: Number(topScore.toFixed(3)),
        sources: []
      });
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
    const rawAnswer = await generateAnswer(system, contents, apiKey);
    const answer = stripLatex(rawAnswer).trim();

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

    return res.status(200).json({
      answer: answer,
      found: true,
      topScore: Number(topScore.toFixed(3)),
      sources: sources
    });
  } catch (error) {
    // Логируем причину на сервере, наружу отдаём общий текст без деталей.
    console.error("Ошибка ask.js: " + error.message);
    return res.status(502).json({ error: "Не удалось получить ответ. Попробуйте ещё раз." });
  }
};
