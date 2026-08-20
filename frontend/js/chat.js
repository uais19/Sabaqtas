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
// Одна тихая строка. Один источник — полная ссылка со страницей.
// Несколько — группируем по книге и перечисляем параграфы без повторов:
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
    // Единственный источник: полная ссылка со страницей.
    const s = sources[0];
    text = "Источник: " + s.book + ", " + shortPart(s.part) + ", " +
      s.paragraph + ", стр. " + s.page;
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

  const typing = addTyping();

  try {
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

    // found: false — честный отказ, рисуем спокойно и без источников.
    addBubble("ai", data.answer, data.found === false);

    // Плашку источника рисуем только когда источники реально есть.
    if (Array.isArray(data.sources) && data.sources.length > 0) {
      addSourceBadge(data.sources);
    }

    // В историю попадают только состоявшиеся вопрос и ответ.
    conversation.push({ role: "user", text: question });
    conversation.push({ role: "ai", text: data.answer });
  } catch (error) {
    // Если сервер прислал понятный текст — показываем его,
    // иначе общее спокойное сообщение.
    typing.remove();
    addSystemLine(error.serverText || "Не получилось связаться с сервером. Попробуй ещё раз");
  }

  isWaiting = false;
  sendButton.disabled = false;
  input.focus();
}

// --- Переключатели ---

function setMode(newMode) {
  if (newMode === mode) return;
  mode = newMode;

  modeButtons.forEach(function (button) {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  modeHint.textContent = MODE_HINTS[mode];
  input.placeholder = MODE_PLACEHOLDERS[mode];

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
