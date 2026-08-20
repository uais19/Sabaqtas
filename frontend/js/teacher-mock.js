// teacher-mock.js — данные для панели учителя.
// Пока бэкенда нет, панель рисуется из этого объекта.
// Источники указываем только до параграфа, без номеров страниц.

const TEACHER_MOCK = {

  class_title: "9А",

  // Ученики класса. У нескольких учеников пробел совпадает — так и бывает
  // в жизни, и именно это учитель должен увидеть в блоке «Что западает».
  students: [
    {
      name: "Айсултан Нурланов",
      root_topic: {
        title: "Сложение и вычитание обыкновенных дробей",
        grade: 5,
        source_ref: "Математика, 5 класс, часть 1, §23"
      },
      progress_percent: 64,
      closed_gaps: 2,
      gave_up_count: 1,
      hints_avg: 2.4,
      last_active: "2026-08-21"
    },
    {
      name: "Дана Сериккызы",
      root_topic: {
        title: "Сложение рациональных чисел с разными знаками",
        grade: 6,
        source_ref: "Математика, 6 класс, часть 1, §13"
      },
      progress_percent: 41,
      closed_gaps: 1,
      gave_up_count: 3,
      hints_avg: 3.8,
      last_active: "2026-08-20"
    },
    {
      name: "Ерасыл Абдрахманов",
      root_topic: {
        title: "Формулы сокращённого умножения",
        grade: 7,
        source_ref: "Алгебра, 7 класс, часть 2, §32"
      },
      progress_percent: 83,
      closed_gaps: 3,
      gave_up_count: 0,
      hints_avg: 1.2,
      last_active: "2026-08-21"
    },
    {
      name: "Мадина Кайратова",
      root_topic: {
        title: "Сложение и вычитание обыкновенных дробей",
        grade: 5,
        source_ref: "Математика, 5 класс, часть 1, §23"
      },
      progress_percent: 27,
      closed_gaps: 0,
      gave_up_count: 2,
      hints_avg: 4.5,
      last_active: "2026-08-19"
    },
    {
      name: "Тимур Жаксылыков",
      root_topic: {
        title: "Сложение рациональных чисел с разными знаками",
        grade: 6,
        source_ref: "Математика, 6 класс, часть 1, §13"
      },
      progress_percent: 55,
      closed_gaps: 1,
      gave_up_count: 1,
      hints_avg: 2.9,
      last_active: "2026-08-20"
    }
  ],

  // Сводка по темам для блока «Что западает у класса».
  // students_struggling — сколько учеников застряло на теме.
  class_stats: [
    {
      title: "Сложение и вычитание обыкновенных дробей",
      grade: 5,
      avg_mastery: 38,
      students_struggling: 3,
      avg_hints: 3.6,
      gave_up_count: 3
    },
    {
      title: "Сложение рациональных чисел с разными знаками",
      grade: 6,
      avg_mastery: 52,
      students_struggling: 2,
      avg_hints: 2.8,
      gave_up_count: 2
    },
    {
      title: "Формулы сокращённого умножения",
      grade: 7,
      avg_mastery: 61,
      students_struggling: 2,
      avg_hints: 2.1,
      gave_up_count: 1
    },
    {
      title: "Квадратные уравнения",
      grade: 8,
      avg_mastery: 74,
      students_struggling: 1,
      avg_hints: 1.5,
      gave_up_count: 1
    }
  ]

};
