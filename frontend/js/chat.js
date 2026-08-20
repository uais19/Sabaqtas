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

// Плашка источника под ответом ИИ. Вызывается ТОЛЬКО когда источники есть:
// пустую плашку или заглушку не рисуем никогда.
function addSourceBadge(sources) {
  const box = document.createElement("div");
  box.className = "msg-sources";
  sources.forEach(function (source) {
    const badge = document.createElement("span");
    badge.className = "source-badge";
    // source.book приходит уже с классом («Математика, 5 класс»),
    // поэтому класс отдельно не добавляем — иначе он задвоится.
    badge.textContent = source.book + ", " +
      source.part + ", " + source.paragraph + ", стр. " + source.page;
    box.append(badge);
  });
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
  const body = { question: question, mode: mode, lang: lang, grade: 5 };
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
      throw new Error("код " + response.status);
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
    // Причина не важна ученику: сеть, сервер, что угодно. Говорим спокойно.
    typing.remove();
    addSystemLine("Не получилось связаться с сервером. Попробуй ещё раз");
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
