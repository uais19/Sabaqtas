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
    "common.langLabel": "Интерфейс тілі",
    "common.grade5": "5 сынып",
    "common.grade6": "6 сынып",
    "common.grade7": "7 сынып",
    "common.grade8": "8 сынып",
    "common.grade9": "9 сынып",
    "common.grade10": "10 сынып",
    "common.grade11": "11 сынып",

    // --- Предметы и уровни (общие для анкеты и других экранов) ---
    "subject.math": "Математика",
    "subject.physics": "Физика — жақында",
    "subject.chemistry": "Химия — жақында",
    "level.weak": "Көбін ұмытып қалдым",
    "level.medium": "Орташа",
    "level.strong": "Өзіме сенімдімін",
    // ҰБТ — Ұлттық бірыңғай тестілеу, казахское название ЕНТ
    "goal.gaps": "Өткен жылдардағы олқылықтарды жою",
    "goal.current": "Ағымдағы тақырыпты меңгеру",
    "goal.ent": "ҰБТ-ға дайындық",
    "goal.olympiad": "Олимпиадаға дайындық",

    // --- Экран входа ---
    "login.title": "Кіру — Sabaqtas",
    "login.heading": "Басталуының алдында",
    "login.subtitle": "Қай сыныпта екеніңді және оқудың мақсаты қандай екенін айт. Одан әрі диагностика бекіту қажет тақырыпты табады.",
    "login.name": "Аты-жөні",
    "login.password": "Құпия сөз",
    "login.grade": "Сынып",
    "login.subject": "Пән",
    "login.level": "Дайындық деңгейі",
    "login.goal": "Мақсат",
    "login.deadline": "Емтихан немесе сынақ күні",
    "login.deadlineNote": "Міндетті емес. Егер нақты күн болса, жеке кабинетте оған дейінгі кері санау басталады.",
    "login.submit": "Бастау",
    "login.demoLabel": "Демо-кіру",
    "login.demoNote": "Немесе дайын аккаунтқа кіріп, өнімді қарап шық.",
    "login.demoStudent": "Оқушы ретінде қарау",
    "login.demoTeacher": "Мұғалім ретінде қарау",
    "login.errorName": "Аты-жөніңді жаз",
    "login.errorPassword": "Құпия сөз кемінде 4 таңба",
    "login.errorHttps": "Тіркелу тек https арқылы жұмыс істейді. Сайтты дискідегі файл емес, сілтеме арқылы аш.",

    // --- Названия тем. Ключ — topic_id из mock.js ---
    "topic.t_8_kvadr": "Квадрат теңдеулер",
    "topic.t_7_fsu": "Қысқаша көбейту формулалары",
    "topic.t_6_ratsion": "Таңбалары әртүрлі рационал сандарды қосу",
    "topic.t_5_drobi": "Жай бөлшектерді қосу және азайту",
    "topic.t_5_umn": "Көбейту және бөлу",

    // --- Экран диагностики ---
    "diag.title": "Диагностика — Sabaqtas",
    "diag.heading": "Диагностика",
    "diag.subtitle": "Шыныңды айт. Білмесең — солай деп жаз, бұл олқылықты тезірек табуға көмектеседі.",
    "diag.chainTitle": "Тексерілгендер",
    "diag.dontKnow": "Білмеймін",
    "diag.grade": "сынып",
    "diag.statusGap": "осында олқылық бар",
    "diag.statusMore": "сұрақ қалды",
    "diag.statusOk": "✓ түсінікті",
    "diag.statusFail": "✕ шыққан жоқ",
    "diag.profileLine": "жоғарыдан бастап, олқылықты тапқанша төмен түсеміз",
    "diag.resultFound": "Қай жерде тұрып қалғаныңды таптық",
    "diag.resultNone": "Олқылық табылған жоқ",
    "diag.resultNoneText": "Өз сыныбыңның тақырыбын сенімді меңгергенсің. Ағымдағы бағдарламадан бастаймыз.",
    "diag.source": "дереккөз — ",
    "diag.makePlan": "Жоспар құру",
    "diag.askAi": "Тақырып бойынша ЖИ-ден сұрау",
    "diag.restart": "Қайта өту",
    "diag.error": "Сұрақты жүктеу мүмкін болмады. Бетті жаңартып, қайта көр.",

    // --- Вопросы диагностики. Ключ — id вопроса из mock.js ---
    // Варианты ответов переведены только там, где они словесные:
    // формулы и числа в переводе не нуждаются, и ключей для них нет —
    // t() вернёт русский оригинал, то есть ту же самую формулу.
    "q.q_8_kv_01.text": "Теңдеуді шеш: x² − 5x + 6 = 0",
    "q.q_8_kv_01.o0": "x = 1 және x = 6",
    "q.q_8_kv_01.o1": "x = 2 және x = 3",
    "q.q_8_kv_01.o2": "x = −2 және x = −3",
    "q.q_8_kv_01.o3": "x = 5 және x = 6",
    "q.q_8_kv_02.text": "x² + 2x + 5 = 0 теңдеуінің неше түбірі бар?",
    "q.q_8_kv_02.o0": "Екі түбір",
    "q.q_8_kv_02.o1": "Бір түбір",
    "q.q_8_kv_02.o2": "Нақты түбірлері жоқ",
    "q.q_8_kv_02.o3": "Шексіз көп",
    "q.q_7_fsu_01.text": "Жақшаны аш: (a − 4)²",
    "q.q_7_fsu_02.text": "Көбейткіштерге жікте: x² − 49",
    "q.q_6_rats_01.text": "Есепте: −7 + 3",
    "q.q_6_rat_02.text": "Қосындының мәнін тап: −14 + 9",
    "q.q_5_drobi_01.text": "Есепте: 2/3 + 1/6",
    "q.q_5_dr_02.text": "Есепте: 1/2 + 1/5",

    // --- Собранные фразы результата диагностики ---
    // В казахском другой порядок слов, поэтому это шаблоны целиком,
    // а не куски, склеенные плюсами.
    "diag.resultOne": "«{root}» тақырыбынан бастаймыз — {grade} сынып. Оны жаппайынша, қалғанын шешудің мәні жоқ.",
    "diag.resultTwo": "«{first}» тақырыбынан емес, «{root}» тақырыбынан бастаймыз — {grade} сынып. Оны жаппайынша, қалғанын шешудің мәні жоқ.",
    "diag.levelNote": " Дайындығыңды «{level}» деп бағаладың, ал олқылық {grade} сыныпта шықты.",
    "diag.profileLineFull": "{name}, жоғарыдан бастап, олқылықты тапқанша төмен түсеміз",
    // --- Личный кабинет ---
    "dash.title": "Менің жоспарым — Sabaqtas",
    "dash.header": "Менің жоспарым",
    "dash.headerNamed": "Менің жоспарым — {name}",
    "dash.rootGapLabel": "Негізгі олқылығың:",
    "dash.rootGapNote": "Бұл тақырыпты жаппайынша, қалғанын шешу пайдасыз.",
    "dash.deadlineHeading": "Кезектегі мақсат",
    "dash.planHeading": "Оқу жоспары",
    "dash.planSub": "Төменнен жоғары қарай: негізгі олқылықтан өз сыныбыңның тақырыбына дейін.",
    "dash.progressHeading": "Прогресс",
    "dash.points": "Ұпай",
    "dash.streak": "Күндер сериясы",
    "dash.closedGaps": "Жабылған олқылықтар",
    "dash.weakHeading": "Әлсіз тұстар",
    "dash.weakSub": "Диагностика сенімсіз деп белгілеген тұстар.",
    "dash.goal": "Мақсат: {goal}",
    "dash.level": "Бастапқы деңгей: {level}",
    "dash.deadlineLeft": "{goal}: {days} күн қалды",
    "dash.deadlineDate": "Күні: {date}",
    "dash.closedOn": "{date} жабылды. Бұл тақырып енді қиындық тудырмайды.",
    "dash.closedNoDate": "Жабылды. Бұл тақырып енді қиындық тудырмайды.",
    "dash.study": "Оқу",
    "dash.view": "Көру",
    "dash.mastery": "Меңгерілгені: {percent}%",
    "dash.error": "Деректерді жүктеу мүмкін болмады. Бетті жаңартыңыз.",
    "dash.goalFallback": "Мақсат",
    // В казахском у слова «күн» нет форм для 1, 2-4 и 5+ — оно одно на все числа
    "dash.daysWord": "күн",

    // --- Достижения ---
    "ach.firstGap": "Алғашқы жабылған олқылық",
    "ach.streak3": "3 күндік серия",
    "ach.noHint": "Көмексіз өттің",
    "ach.firstDiag": "Алғашқы диагностика",

    // --- Месяцы для длинных дат («15 маусым 2027») ---
    "month.1": "қаңтар", "month.2": "ақпан", "month.3": "наурыз",
    "month.4": "сәуір", "month.5": "мамыр", "month.6": "маусым",
    "month.7": "шілде", "month.8": "тамыз", "month.9": "қыркүйек",
    "month.10": "қазан", "month.11": "қараша", "month.12": "желтоқсан",
    // --- Экран темы и заданий ---
    "topicScreen.title": "Тақырып және тапсырмалар — Sabaqtas",
    "topicScreen.toPlan": "Жоспарға",
    "topicScreen.backToPlan": "Жоспарға оралу",
    "topicScreen.materialHeading": "Оқулықтағы ереже",
    "topicScreen.source": "Дереккөз: ",
    "topicScreen.diffEasy": "оңай",
    "topicScreen.diffNormal": "қалыпты",
    "topicScreen.diffHard": "күрделі",
    "topicScreen.taskProgress": "{index}/{total} тапсырма · {level} деңгей",
    "topicScreen.harder": " — күрделене түсті",
    "topicScreen.easier": " — жеңілдеді",
    "topicScreen.seeSummary": "Қорытындыны көру",
    "topicScreen.nextTask": "Келесі тапсырма",
    "topicScreen.correct": "Дұрыс",
    "topicScreen.wrong": "Әзірге дұрыс емес. Тағы бір көр",
    "topicScreen.mentor": "Өзім шешейін, көмектес",
    "topicScreen.reveal": "Жауабын көрсету",
    "topicScreen.correctAnswer": "Дұрыс жауап: {answer}",
    "topicScreen.noPoints": "Бұл тапсырма үшін ұпай берілмеді — келесіде өзің жет.",
    "topicScreen.summary": "Тапсырмалар аяқталды. {points} ұпай жинадың.",
    "topicScreen.firstTry": "Бірінші реттен: {count} / {total}",
    "topicScreen.error": "Тақырыпты жүктеу мүмкін болмады. Бетті жаңартыңыз."


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

// Перевод с подстановкой значений.
//
// В шаблоне места для подстановки помечены фигурными скобками:
//   "{topic} тақырыбынан бастаймыз" + {topic: "Дроби"}
//
// Нужно там, где фраза собирается из кусков: в русском и казахском
// порядок слов разный, и склеивать строку плюсами нельзя — получится
// правильный русский и сломанный казахский.
function tFormat(key, fallback, values) {
  let text = t(key, fallback);
  Object.keys(values).forEach(function (name) {
    text = text.split("{" + name + "}").join(values[name]);
  });
  return text;
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
