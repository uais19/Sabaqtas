// mock.js — поддельные ответы бэкенда.
// Пока бэкенд не готов, фронтенд берёт данные отсюда.
// Сценарий: предмет — математика, ученик 9 класса.
// Цепочка пререквизитов диагностики:
//   Квадратные уравнения (9) -> Формулы сокращённого умножения (7)
//   -> Действия с дробями (6) -> Умножение и деление (5)
// Готового сценария ответов здесь нет: api.js сравнивает выбранный вариант
// с correct_index и сам решает, спускаться ниже или заканчивать.

const MOCK = {

  // Цепочка тем-пререквизитов: сверху тема текущего класса, ниже — то,
  // на чём она держится. Диагностика идёт по этому списку сверху вниз.
  //
  // correct_index — номер верного варианта в options (нумерация с нуля).
  // Верные ответы стоят на разных местах (2, 0, 3, 1), чтобы их нельзя
  // было угадать по позиции кнопки.
  diagnosticChain: [

    {
      topic_id: "t_9_kvadr",
      topic_title: "Квадратные уравнения",
      grade: 9,
      source_ref: "Алгебра, 9 класс, §5, стр. 34",
      question: {
        id: "q_9_kv_01",
        text: "Найдите корни уравнения x² − 5x + 6 = 0",
        options: ["x = −2 и x = −3", "x = 1 и x = 6", "x = 2 и x = 3", "x = 5 и x = 6"],
        correct_index: 2
      }
    },

    {
      topic_id: "t_7_fsu",
      topic_title: "Формулы сокращённого умножения",
      grade: 7,
      source_ref: "Алгебра, 7 класс, §21, стр. 104",
      question: {
        id: "q_7_fsu_01",
        text: "Раскройте скобки: (a − 4)²",
        options: ["a² − 8a + 16", "a² − 16", "a² + 8a + 16", "a² − 4a + 16"],
        correct_index: 0
      }
    },

    {
      topic_id: "t_6_drobi",
      topic_title: "Действия с дробями",
      grade: 6,
      source_ref: "Математика, 6 класс, §12, стр. 78",
      question: {
        id: "q_6_drobi_01",
        text: "Вычислите: 2/3 + 1/6",
        options: ["3/9", "1/2", "3/6", "5/6"],
        correct_index: 3
      }
    },

    {
      topic_id: "t_5_umn",
      topic_title: "Умножение и деление",
      grade: 5,
      source_ref: "Математика, 5 класс, §7, стр. 41",
      question: {
        id: "q_5_umn_01",
        text: "Вычислите: 48 : 6 · 3",
        options: ["8", "24", "16", "144"],
        correct_index: 1
      }
    }

  ],

  // План обучения: начинается с корневого пробела и поднимается вверх по цепочке.
  plan: {
    plan_id: "plan_2001",
    items: [
      {
        topic_id: "t_6_drobi",
        title: "Действия с дробями",
        reason: "Корневой пробел: ошибка при сложении дробей с разными знаменателями.",
        source_ref: "Математика, 6 класс, §12, стр. 78"
      },
      {
        topic_id: "t_7_fsu",
        title: "Формулы сокращённого умножения",
        reason: "Без уверенных действий с дробями формулы не закрепляются.",
        source_ref: "Алгебра, 7 класс, §21, стр. 104"
      },
      {
        topic_id: "t_9_kvadr",
        title: "Квадратные уравнения",
        reason: "Тема текущего класса, ради которой и запускалась диагностика.",
        source_ref: "Алгебра, 9 класс, §5, стр. 34"
      }
    ]
  },

  // Прогресс ученика для дашборда.
  progress: {
    root_topic: {
      id: "t_6_drobi",
      title: "Действия с дробями",
      grade: 6,
      source_ref: "Математика, 6 класс, §12, стр. 78"
    },
    topics: [
      { topic_id: "t_6_drobi", title: "Действия с дробями", grade: 6, mastery: 62, status: "в работе" },
      { topic_id: "t_7_fsu", title: "Формулы сокращённого умножения", grade: 7, mastery: 20, status: "не начата" },
      { topic_id: "t_9_kvadr", title: "Квадратные уравнения", grade: 9, mastery: 10, status: "не начата" }
    ],
    closed_gaps: [
      { topic_id: "t_5_umn", title: "Умножение и деление", grade: 5, closed_at: "2026-08-14" }
    ],
    points: 340,
    streak_days: 5,
    achievements: [
      { id: "ach_first_diag", title: "Первая диагностика", description: "Прошёл диагностику до конца" },
      { id: "ach_streak_5", title: "5 дней подряд", description: "Занимался 5 дней без пропусков" },
      { id: "ach_first_gap", title: "Первый закрытый пробел", description: "Закрыл тему «Умножение и деление»" }
    ]
  },

  // Обычный вопрос: ответ найден в учебнике, есть ссылки на источник.
  askExplain: {
    answer: "Чтобы сложить дроби с разными знаменателями, их сначала приводят к общему знаменателю. Для 2/3 и 1/6 общий знаменатель — 6: дробь 2/3 умножают на 2 и получают 4/6. Затем складывают числители: 4/6 + 1/6 = 5/6.",
    found: true,
    sources: [
      {
        book: "Математика, 6 класс",
        paragraph: "§12",
        page: 78,
        snippet: "Чтобы сложить дроби с разными знаменателями, надо привести их к общему знаменателю, а затем сложить числители."
      },
      {
        book: "Математика, 6 класс",
        paragraph: "§12",
        page: 79,
        snippet: "Общим знаменателем удобно брать наименьшее общее кратное знаменателей данных дробей."
      }
    ]
  },

  // Вопрос, ответа на который нет в загруженных учебниках.
  askNotFound: {
    answer: "Этого нет в загруженных учебниках.",
    found: false,
    sources: []
  },

  // Тот же формат ответа, но текст на казахском языке.
  askKazakh: {
    answer: "Бөлімдері әртүрлі бөлшектерді қосу үшін оларды алдымен ортақ бөлімге келтіру керек. 2/3 және 1/6 үшін ортақ бөлім — 6: 2/3 бөлшегін 2-ге көбейтіп, 4/6 аламыз. Содан кейін алымдарын қосамыз: 4/6 + 1/6 = 5/6.",
    found: true,
    sources: [
      {
        book: "Математика, 6 сынып",
        paragraph: "§12",
        page: 78,
        snippet: "Бөлімдері әртүрлі бөлшектерді қосу үшін оларды ортақ бөлімге келтіріп, содан кейін алымдарын қосу керек."
      }
    ]
  },

  // Режим наставника: ответ — наводящий вопрос, готового решения в нём нет.
  mentorReply: {
    reply: "Давай разберёмся вместе. Посмотри на знаменатели 3 и 6: можно ли одно число получить из другого умножением? Какое число тогда стоит взять общим знаменателем?",
    hints_count: 1,
    solved: false
  },

  // Список учеников для панели учителя — у каждого свой корневой пробел.
  teacherStudents: [
    {
      student_id: "st_01",
      name: "Айсултан Нурланов",
      grade: 9,
      root_topic: { id: "t_6_drobi", title: "Действия с дробями", grade: 6 },
      progress_percent: 62,
      closed_gaps: 1,
      last_active: "2026-08-18"
    },
    {
      student_id: "st_02",
      name: "Дана Сериккызы",
      grade: 9,
      root_topic: { id: "t_5_poryadok", title: "Порядок действий", grade: 5 },
      progress_percent: 35,
      closed_gaps: 0,
      last_active: "2026-08-17"
    },
    {
      student_id: "st_03",
      name: "Ерасыл Абдрахманов",
      grade: 9,
      root_topic: { id: "t_7_fsu", title: "Формулы сокращённого умножения", grade: 7 },
      progress_percent: 78,
      closed_gaps: 2,
      last_active: "2026-08-18"
    },
    {
      student_id: "st_04",
      name: "Мадина Кайратова",
      grade: 9,
      root_topic: { id: "t_8_lineyn", title: "Линейные уравнения", grade: 8 },
      progress_percent: 90,
      closed_gaps: 3,
      last_active: "2026-08-16"
    },
    {
      student_id: "st_05",
      name: "Тимур Жаксылыков",
      grade: 9,
      root_topic: { id: "t_6_procent", title: "Проценты", grade: 6 },
      progress_percent: 18,
      closed_gaps: 0,
      last_active: "2026-08-12"
    }
  ],

  // Статистика по классу для панели учителя.
  teacherClassStats: {
    class_title: "9 «Б» класс",
    students_total: 5,
    topics: [
      {
        topic_id: "t_6_drobi",
        title: "Действия с дробями",
        grade: 6,
        avg_mastery: 48,
        students_struggling: 3,
        avg_hints: 2.6,
        gave_up_count: 1
      },
      {
        topic_id: "t_7_fsu",
        title: "Формулы сокращённого умножения",
        grade: 7,
        avg_mastery: 55,
        students_struggling: 2,
        avg_hints: 3.1,
        gave_up_count: 2
      },
      {
        topic_id: "t_8_lineyn",
        title: "Линейные уравнения",
        grade: 8,
        avg_mastery: 72,
        students_struggling: 1,
        avg_hints: 1.4,
        gave_up_count: 0
      },
      {
        topic_id: "t_9_kvadr",
        title: "Квадратные уравнения",
        grade: 9,
        avg_mastery: 31,
        students_struggling: 4,
        avg_hints: 4.2,
        gave_up_count: 3
      }
    ]
  }

};
