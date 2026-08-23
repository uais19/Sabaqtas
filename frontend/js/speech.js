// speech.js — озвучка текста вслух.
//
// Зачем: не каждый ученик читает с экрана одинаково легко. Детям с
// дислексией, слабовидящим и просто младшим школьникам проще слушать.
// Кейс называет это «функции для учеников с особыми образовательными
// потребностями», и для трека Social Impact это не украшение, а доступность.
//
// Чем сделано: speechSynthesis — синтез речи, встроенный в сам браузер.
// Никакой библиотеки, никакого ключа, никаких запросов наружу: текст
// не покидает устройство ученика. Работает и без интернета.
//
// Что важно знать про голоса: набор голосов даёт операционная система,
// а не мы. Русский есть почти везде, казахского на многих системах нет.
// Поэтому мы не притворяемся, что озвучили по-казахски, если голоса нет —
// кнопка честно скажет об этом.

// Поддерживает ли браузер синтез речи вообще.
// Проверяем один раз: если нет — кнопки просто не рисуем, ничего не ломая.
function speechSupported() {
  return typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance === "function";
}

// Код языка для синтезатора. Наши "ru"/"kk" -> то, что понимает браузер.
function speechLangCode(lang) {
  return lang === "kk" ? "kk-KZ" : "ru-RU";
}

// Есть ли в системе голос для этого языка.
//
// getVoices() коварен: при первом вызове список часто пуст, он приходит
// позже событием voiceschanged. Поэтому пустой список мы НЕ считаем
// отказом — пробуем говорить и надеемся на голос по умолчанию.
function hasVoiceFor(lang) {
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    return true;
  }
  const wanted = speechLangCode(lang).toLowerCase().slice(0, 2);
  return voices.some(function (voice) {
    return voice.lang && voice.lang.toLowerCase().slice(0, 2) === wanted;
  });
}

// Остановить чтение, если оно идёт.
function stopSpeaking() {
  if (speechSupported()) {
    window.speechSynthesis.cancel();
  }
}

// Прочитать текст вслух.
// onEnd вызывается, когда чтение закончилось или прервалось —
// по нему кнопка возвращает себе обычный вид.
function speak(text, lang, onEnd) {
  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechLangCode(lang);
  // Чуть медленнее обычного: текст учебный, его слушают, чтобы понять,
  // а не чтобы быстрее закончить.
  utterance.rate = 0.95;

  // onend не срабатывает, если речь отменили через cancel(), поэтому
  // подписываемся и на onerror — иначе кнопка застрянет в состоянии «читаю».
  utterance.onend = onEnd;
  utterance.onerror = onEnd;

  window.speechSynthesis.speak(utterance);
}

// Кнопка «Прослушать» рядом с текстом.
//
// getText — функция, возвращающая текст в момент нажатия (а не при
// создании кнопки): в чате текст ответа появляется не сразу.
// getLang — то же самое для языка: ученик мог переключить Рус/Қаз.
//
// Возвращает готовый элемент или null, если браузер не умеет говорить —
// в этом случае вызывающий код просто ничего не добавляет на страницу.
function createSpeakButton(getText, getLang) {
  if (!speechSupported()) {
    return null;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "speak-button";
  button.textContent = "Прослушать";
  // Кнопка состоит из одного слова, но экранному диктору нужно понимать,
  // что именно она озвучит.
  button.setAttribute("aria-label", "Прослушать текст вслух");

  let speaking = false;

  function reset() {
    speaking = false;
    button.textContent = "Прослушать";
    button.classList.remove("is-speaking");
  }

  button.addEventListener("click", function () {
    // Второе нажатие останавливает чтение — иначе, чтобы прервать
    // длинный ответ, ученику пришлось бы перезагружать страницу.
    if (speaking) {
      stopSpeaking();
      reset();
      return;
    }

    const text = getText();
    if (!text) {
      return;
    }

    const lang = getLang ? getLang() : "ru";
    if (!hasVoiceFor(lang)) {
      // Честно говорим, что голоса нет, вместо того чтобы прочитать
      // казахский текст русским голосом — это звучит как каша.
      button.textContent = "Нет голоса для этого языка";
      button.disabled = true;
      return;
    }

    speaking = true;
    button.textContent = "Остановить";
    button.classList.add("is-speaking");
    speak(text, lang, reset);
  });

  return button;
}

// Уходя со страницы, обрываем чтение: иначе браузер продолжает говорить
// на следующем экране, и это выглядит как сбой.
window.addEventListener("pagehide", stopSpeaking);
