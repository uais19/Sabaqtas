// chat.js — экран разговора с ИИ.
// Два режима: «Объясни» отвечает по учебнику, «Помоги решить самому» ведёт
// к ответу вопросами. Запросы уходят в серверную функцию /api/ask.

// --- Состояние экрана ---
let mode = "explain";     // "explain" или "mentor"
let lang = "ru";          // "ru" или "kk"
let conversation = [];    // история: {role: "user" | "ai", text}
let isWaiting = false;    // пока ждём ответ, второй запрос не отправляем

// --- Элементы страницы ---
const messagesBox = document.getElementById("messages");
const input = document.getElementById("input");
const sendButton = document.getElementById("send");
const modeHint = document.getElementById("mode-hint");
const modeButtons = document.querySelectorAll(".mode-button");
const langButtons = document.querySelectorAll(".lang-button");
const gradeSelect = document.getElementById("grade");

// Тексты, которые меняются вместе с режимом.
const MODE_HINTS = {
  explain: "Отвечаю по учебнику и показываю источник",
  mentor: "Не назову ответ. Доведу до него вопросами"
};
const MODE_PLACEHOLDERS = {
  explain: "Спроси что угодно по теме",
  mentor: "Напиши задачу, с которой застрял"
};

// --- Отрисовка сообщений ---

// Лента всегда прокручена к последнему сообщению.
function scrollToBottom() {
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// Пузырь сообщения. from — "user" или "ai".
// muted = true рисует ответ приглушённо: так выглядит честное
// «этого нет в учебниках», это не ошибка и не должно пугать.
function addBubble(from, text, muted) {
  const bubble = document.createElement("div");
  bubble.className = from === "user" ? "msg msg-user" : "msg msg-ai";
  if (muted) bubble.classList.add("msg-muted");
  bubble.textContent = text;
  messagesBox.append(bubble);
  scrollToBottom();
  return bubble;
}

// «часть 1» -> «ч.1», чтобы строка источника оставалась короткой.
function shortPart(part) {
  return part ? part.replace("часть ", "ч.") : "";
}

// Плашка источника под ответом ИИ. Вызывается ТОЛЬКО когда источники есть:
// пустую плашку или заглушку не рисуем никогда.
// Одна тихая строка, всегда БЕЗ страницы: номера параграфов в казахском
// и русском изданиях совпадают, а номера страниц расходятся примерно
// на две — «стр. 61» русского издания в казахском ведёт не туда.
// Один источник — книга, часть и параграф. Несколько — группируем по книге
// и перечисляем параграфы без повторов:
// «Источник: Математика, 5 класс, ч.1 — §12, §13, §14».
function addSourceBadge(sources) {
  // Группируем по книге (book приходит уже с классом: «Математика, 5 класс»).
  // Внутри группы параграфы без дублей — одинаковые куски одного параграфа
  // не должны превращаться в «§12, §12, §12».
  const groups = [];
  sources.forEach(function (source) {
    const key = source.book + "|" + source.part;
    let group = groups.find(function (g) { return g.key === key; });
    if (!group) {
      group = { key: key, book: source.book, part: source.part, paragraphs: [] };
      groups.push(group);
    }
    if (group.paragraphs.indexOf(source.paragraph) === -1) {
      group.paragraphs.push(source.paragraph);
    }
  });

  let text;
  if (sources.length === 1) {
    // Единственный источник: книга, часть, параграф. Страницы нет — как везде.
    const s = sources[0];
    text = "Источник: " + s.book + ", " + shortPart(s.part) + ", " + s.paragraph;
  } else {
    text = "Источник: " + groups.map(function (g) {
      return g.book + ", " + shortPart(g.part) + " — " + g.paragraphs.join(", ");
    }).join("; ");
  }

  const box = document.createElement("div");
  box.className = "msg-sources";
  const badge = document.createElement("span");
  badge.className = "source-badge";
  badge.textContent = text;
  box.append(badge);
  messagesBox.append(box);
  scrollToBottom();
}

// Служебная строка по центру ленты («Режим изменён…»).
function addSystemLine(text) {
  const line = document.createElement("p");
  line.className = "msg-system";
  line.textContent = text;
  messagesBox.append(line);
  scrollToBottom();
}

// Индикатор «печатает» с тремя точками. Возвращаем элемент,
// чтобы убрать его, когда придёт ответ.
function addTyping() {
  const typing = document.createElement("div");
  typing.className = "msg msg-ai msg-typing";
  typing.innerHTML = "печатает<span class=\"dot\">.</span>" +
    "<span class=\"dot\">.</span><span class=\"dot\">.</span>";
  messagesBox.append(typing);
  scrollToBottom();
  return typing;
}

// Тихая пометка под ответом, который взяли из кэша, а не спросили заново.
function addCacheNote() {
  const note = document.createElement("p");
  note.className = "msg-cache-note";
  note.textContent = "из сохранённых ответов";
  messagesBox.append(note);
  scrollToBottom();
}

// Ответ ИИ целиком: пузырь, плашка источников и пометка о кэше.
// Одна функция на оба случая — свежий ответ и ответ из кэша выглядят
// одинаково, отличает их только тихая строчка снизу.
function showAnswer(data, fromCache) {
  // found: false — честный отказ, рисуем спокойно и без источников.
  addBubble("ai", data.answer, data.found === false);

  // Плашку источника рисуем только когда источники реально есть.
  if (Array.isArray(data.sources) && data.sources.length > 0) {
    addSourceBadge(data.sources);
  }

  if (fromCache) {
    addCacheNote();
  }
}

// --- Кэш ответов в браузере ---
//
// Кэш экономит дневную квоту и делает демо устойчивым — на сцене повторный
// вопрос отвечается мгновенно и без обращения к API. Бесплатный тариф даёт
// всего 20 генераций в день на каждую модель, поэтому каждый сэкономленный
// запрос на счету.
//
// Храним в localStorage простым списком: новые ответы в конце, старые
// в начале. Так «выбросить самый старый» — это просто снять первый элемент.

const CACHE_STORAGE_KEY = "sabaqtas-answers";
const CACHE_LIMIT = 100;

// Ключ — всё, что меняет ответ: сам вопрос, режим, язык и класс.
// Вопрос приводим к нижнему регистру и обрезаем пробелы, чтобы
// «Что такое дробь?» и «что такое дробь? » считались одним вопросом.
function cacheKey(question, mode, lang, grade) {
  return question.trim().toLowerCase() + "|" + mode + "|" + lang + "|" + grade;
}

// Любое обращение к localStorage обёрнуто в try/catch: в приватном режиме
// браузера он бросает исключение, а место в нём может кончиться. Кэш —
// приятное дополнение, экран из-за него падать не должен.
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function writeCache(list) {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(list));
  } catch (error) {
    // Запись запрещена или кончилось место — просто работаем без кэша.
    console.log("Кэш ответов недоступен: " + error.message);
  }
}

// Ответ из кэша или null, если такого вопроса ещё не было.
function cacheGet(key) {
  const found = readCache().find(function (item) {
    return item.key === key;
  });
  return found ? found.data : null;
}

function cacheSet(key, data) {
  // Старую запись с тем же ключом убираем, чтобы ответ не задвоился.
  const list = readCache().filter(function (item) {
    return item.key !== key;
  });
  list.push({ key: key, data: data });

  // Список переполнен — самые старые уходят с начала.
  while (list.length > CACHE_LIMIT) {
    list.shift();
  }
  writeCache(list);
}

// --- Отправка вопроса ---

async function send() {
  const question = input.value.trim();
  if (question === "" || isWaiting) return;

  isWaiting = true;
  sendButton.disabled = true;
  input.value = "";

  addBubble("user", question);

  // Тело запроса. Историю шлём только в режиме наставника: там ИИ должен
  // помнить разговор. В режиме «объясни» каждый вопрос независим.
  // Класс берём из выпадающего списка — он не зашит в код.
  const body = {
    question: question,
    mode: mode,
    lang: lang,
    grade: Number(gradeSelect.value)
  };
  if (mode === "mentor") {
    body.history = conversation.slice();
  }

  const key = cacheKey(question, mode, lang, body.grade);

  // Кэшируем только первую реплику диалога. Дальше ответ зависит от истории,
  // а её в ключе нет — вернули бы ответ на другой вопрос.
  // В запросе без истории (режим «объясни» — всегда, наставник — только
  // первая реплика) ответ от разговора не зависит, его кэшировать можно.
  const cacheable = !body.history || body.history.length === 0;

  const typing = addTyping();

  try {
    // Этот вопрос уже спрашивали — отвечаем из кэша, в сеть не идём
    // и дневную квоту Gemini не тратим.
    const cached = cacheable ? cacheGet(key) : null;
    if (cached) {
      typing.remove();
      showAnswer(cached, true);
      conversation.push({ role: "user", text: question });
      conversation.push({ role: "ai", text: cached.answer });
      return;
    }

    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      // Сервер мог объяснить причину по-человечески — например, что
      // запросов слишком много и надо чуть подождать. Тогда показываем
      // его текст: ученик должен понять, что это временно, а не поломка.
      let serverText = "";
      try {
        const errorData = await response.json();
        if (errorData && typeof errorData.error === "string") {
          serverText = errorData.error;
        }
      } catch (parseError) {
        // тело не JSON — покажем общее сообщение
      }
      const failure = new Error("код " + response.status);
      failure.serverText = serverText;
      throw failure;
    }

    const data = await response.json();
    typing.remove();

    // Какая модель ответила — только в консоль, ученику это не нужно.
    if (data.model) {
      console.log("Ответила модель: " + data.model);
    }

    showAnswer(data, false);

    // В кэш кладём только состоявшийся ответ: сбои и ошибки квоты сюда
    // не доходят, они уходят в catch. А честное «этого нет в учебниках» —
    // настоящий результат, его кэшируем наравне с обычным ответом.
    if (cacheable) {
      cacheSet(key, {
        answer: data.answer,
        found: data.found,
        sources: data.sources
      });
    }

    // В историю попадают только состоявшиеся вопрос и ответ.
    conversation.push({ role: "user", text: question });
    conversation.push({ role: "ai", text: data.answer });
  } catch (error) {
    // Если сервер прислал понятный текст — показываем его,
    // иначе общее спокойное сообщение.
    typing.remove();
    addSystemLine(error.serverText || "Не получилось связаться с сервером. Попробуй ещё раз");
  } finally {
    // finally, а не просто хвост функции: из ветки с кэшем мы выходим
    // через return, а разблокировать ввод нужно в любом случае.
    isWaiting = false;
    sendButton.disabled = false;
    input.focus();
  }
}

// --- Переключатели ---

// Показываем текущий режим на кнопках и в подсказках. Ленту не трогаем.
function paintMode() {
  modeButtons.forEach(function (button) {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  modeHint.textContent = MODE_HINTS[mode];
  input.placeholder = MODE_PLACEHOLDERS[mode];
}

function setMode(newMode) {
  if (newMode === mode) return;
  mode = newMode;
  paintMode();

  // Новый режим — новый разговор: у режимов разные правила,
  // и старая история только запутает наставника.
  conversation = [];
  messagesBox.textContent = "";
  addSystemLine("Режим изменён. Начнём заново.");
}

function setLang(newLang) {
  lang = newLang;
  langButtons.forEach(function (button) {
    button.classList.toggle("is-active", button.dataset.lang === lang);
  });
}

modeButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    setMode(button.dataset.mode);
  });
});

langButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    setLang(button.dataset.lang);
  });
});

sendButton.addEventListener("click", send);

// Enter отправляет, Shift+Enter переносит строку.
input.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

// --- Режим из адреса страницы ---

// С экрана заданий ученик попадает сюда по ссылке chat.html?mode=mentor —
// после неудачной попытки решить задачу. Включаем режим наставника сразу,
// чтобы он не искал переключатель руками.
// setMode здесь не годится: он чистит ленту и пишет «Режим изменён»,
// а лента на только что открытой странице и так пустая.
function applyModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "mentor") {
    mode = "mentor";
    paintMode();
  }
}

applyModeFromUrl();

// --- Класс из анкеты ---

// Класс ученика уже спрашивали при входе — второй раз спрашивать незачем.
// Ставим его в переключатель как начальное значение; поменять руками
// по-прежнему можно, если ученик хочет объяснение попроще или посложнее.
//
// Молча ничего не делаем, когда: профиля нет (жюри открыло страницу по
// прямой ссылке), класс не записан или такого варианта нет в списке.
// Во всех трёх случаях остаётся 8 класс, выбранный в разметке.
function applyGradeFromProfile() {
  // readProfile живёт в profile.js. Если файл почему-то не подключился,
  // экран должен работать дальше, а не падать целиком.
  if (typeof readProfile !== "function") {
    return;
  }
  const profile = readProfile();
  if (!profile || !profile.grade) {
    return;
  }
  const wanted = String(profile.grade);
  const options = gradeSelect.options;
  for (let i = 0; i < options.length; i++) {
    if (options[i].value === wanted) {
      gradeSelect.value = wanted;
      return;
    }
  }
}

applyGradeFromProfile();
