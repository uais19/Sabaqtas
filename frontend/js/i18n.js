// i18n.js — язык интерфейса: русский и казахский.
//
// Почему два языка, а не три: русский и казахский — государственные языки
// Казахстана, на них учатся в школах. Английский нашей целевой аудитории —
// школьнику из аула — не нужен.
//
// ГЛАВНЫЙ ПРИНЦИП, от которого зависит безопасность всей затеи:
// русский текст остаётся в разметке как обычный текст, а атрибут data-i18n
// хранит только КЛЮЧ перевода. Если казахского перевода для ключа нет,
// на экране остаётся русский — ничего не пропадает и не ломается.
// Поэтому переводить можно постепенно, экран за экраном.
//
// Что переводим: надписи интерфейса и вопросы диагностики.
// Что НЕ переводим: правила из учебника и задания. Продукт обещает ответ
// дословно из учебника со ссылкой на параграф — наш собственный перевод
// цитаты сделал бы эту ссылку неправдой. Для казахского нужны казахские
// издания учебников, это следующий шаг.

// Где храним выбор языка. Ключ отдельный от языка ответов ИИ в чате:
// ученик может читать интерфейс по-казахски, а ответы просить по-русски.
const UI_LANG_KEY = "sabaqtas-ui-lang";

// Словарь. Ключи — короткие имена вида "экран.элемент".
// Русского словаря нет намеренно: русский лежит прямо в разметке.
const TRANSLATIONS = {
  kk: {
    // --- Общее ---
    "common.brand": "Sabaqtas",
    "common.toPlan": "Жоспарға",
    "common.lang.ru": "Рус",
    "common.lang.kk": "Қаз",
    "common.langLabel": "Интерфейс тілі"
  }
};

// Текущий язык интерфейса: "ru" или "kk".
// Любая ошибка чтения localStorage (приватный режим, запрет) —
// это просто русский язык, а не сломанная страница.
function uiLang() {
  try {
    const saved = localStorage.getItem(UI_LANG_KEY);
    return saved === "kk" ? "kk" : "ru";
  } catch (error) {
    return "ru";
  }
}

// Запомнить выбор языка. Возвращает false, если сохранить не удалось:
// вызывающий код всё равно продолжит работу, просто выбор не переживёт
// перезагрузку страницы.
function setUiLang(lang) {
  try {
    localStorage.setItem(UI_LANG_KEY, lang === "kk" ? "kk" : "ru");
    return true;
  } catch (error) {
    return false;
  }
}

// Перевод по ключу.
//
// fallback — русский текст. Он возвращается всегда, когда язык русский
// или когда казахского перевода для этого ключа ещё нет. Именно поэтому
// недопереведённый экран выглядит как русский, а не как пустой.
function t(key, fallback) {
  const lang = uiLang();
  if (lang === "ru") {
    return fallback;
  }
  const dictionary = TRANSLATIONS[lang];
  if (dictionary && typeof dictionary[key] === "string") {
    return dictionary[key];
  }
  return fallback;
}

// Пройти по разметке и подставить переводы.
//
// Обрабатываем три атрибута:
//   data-i18n             — текст внутри элемента
//   data-i18n-placeholder — подсказка в поле ввода
//   data-i18n-label       — aria-label для экранного диктора
//
// Русский текст, который уже лежит в разметке, служит запасным вариантом:
// читаем его до подстановки и передаём в t() как fallback.
function applyTranslations(root) {
  const scope = root || document;

  scope.querySelectorAll("[data-i18n]").forEach(function (element) {
    const key = element.getAttribute("data-i18n");
    // Запоминаем исходный русский текст один раз: если ученик переключит
    // язык туда-обратно, второй раз брать его будет уже неоткуда.
    if (!element.hasAttribute("data-i18n-ru")) {
      element.setAttribute("data-i18n-ru", element.textContent);
    }
    element.textContent = t(key, element.getAttribute("data-i18n-ru"));
  });

  scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
    const key = element.getAttribute("data-i18n-placeholder");
    if (!element.hasAttribute("data-i18n-placeholder-ru")) {
      element.setAttribute("data-i18n-placeholder-ru", element.placeholder || "");
    }
    element.placeholder = t(key, element.getAttribute("data-i18n-placeholder-ru"));
  });

  scope.querySelectorAll("[data-i18n-label]").forEach(function (element) {
    const key = element.getAttribute("data-i18n-label");
    if (!element.hasAttribute("data-i18n-label-ru")) {
      element.setAttribute("data-i18n-label-ru", element.getAttribute("aria-label") || "");
    }
    element.setAttribute("aria-label", t(key, element.getAttribute("data-i18n-label-ru")));
  });

  // Говорим браузеру, на каком языке страница. От этого зависит
  // перенос слов и работа экранных дикторов.
  document.documentElement.lang = uiLang();
}

// Переключить язык и перерисовать страницу.
//
// Перезагружаем страницу целиком, а не только надписи: экраны рисуют
// часть текста из JavaScript уже после загрузки, и обойти их все
// вручную — источник ошибок. Перезагрузка честнее и надёжнее.
function switchUiLang(lang) {
  if (lang === uiLang()) {
    return;
  }
  setUiLang(lang);
  window.location.reload();
}

// Собрать переключатель «Рус / Қаз».
// Возвращает готовый элемент — куда его поставить, решает страница.
function createLangSwitch() {
  const box = document.createElement("div");
  box.className = "ui-lang-switch";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", t("common.langLabel", "Язык интерфейса"));

  [["ru", "Рус"], ["kk", "Қаз"]].forEach(function (pair) {
    const code = pair[0];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-lang-button";
    button.textContent = pair[1];
    if (code === uiLang()) {
      button.classList.add("is-active");
    }
    button.addEventListener("click", function () {
      switchUiLang(code);
    });
    box.append(button);
  });

  return box;
}

// Подставляем переводы сразу, как только разметка готова.
// DOMContentLoaded, а не load: ждать картинки незачем, а до этого момента
// элементов на странице ещё нет.
document.addEventListener("DOMContentLoaded", function () {
  applyTranslations();

  // Переключатель показываем только там, где страница сама попросила —
  // то есть где в разметке есть пустой контейнер с этим id. Это лендинг
  // и анкета: язык выбирается на входе и дальше не мешается на экране.
  const slot = document.getElementById("ui-lang-slot");
  if (slot) {
    slot.append(createLangSwitch());
  }
});
