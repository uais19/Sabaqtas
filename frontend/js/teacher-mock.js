// Данные для панели учителя. Пока бэкенда нет, страница получает их отсюда.
const TEACHER_MOCK = {
  class_title: "9А",
  students: [
    {
      name: "Айдана Сейтова",
      grade: "9А",
      root_topic: {
        title: "Сложение и вычитание обыкновенных дробей",
        grade: 5,
        source_ref: "Математика, 5 класс, часть 1, §23, стр. 112"
      },
      progress_percent: 72,
      closed_gaps: 3,
      gave_up_count: 1
    },
    {
      name: "Нуртас Касымов",
      grade: "9А",
      root_topic: {
        title: "Сложение рациональных чисел с разными знаками",
        grade: 6,
        source_ref: "Математика, 6 класс, часть 1, §13, стр. 96"
      },
      progress_percent: 37,
      closed_gaps: 1,
      gave_up_count: 3
    },
    {
      name: "Аружан Бекенова",
      grade: "9А",
      root_topic: {
        title: "Формулы сокращённого умножения",
        grade: 7,
        source_ref: "Алгебра, 7 класс, часть 2, §32, стр. 187"
      },
      progress_percent: 64,
      closed_gaps: 2,
      gave_up_count: 0
    },
    {
      name: "Данияр Ермеков",
      grade: "9А",
      root_topic: {
        title: "Сложение и вычитание обыкновенных дробей",
        grade: 5,
        source_ref: "Математика, 5 класс, часть 1, §23, стр. 112"
      },
      progress_percent: 18,
      closed_gaps: 0,
      gave_up_count: 2
    },
    {
      name: "Мөлдір Сапарова",
      grade: "9А",
      root_topic: {
        title: "Сложение рациональных чисел с разными знаками",
        grade: 6,
        source_ref: "Математика, 6 класс, часть 1, §13, стр. 96"
      },
      progress_percent: 88,
      closed_gaps: 4,
      gave_up_count: 1
    }
  ],
  class_stats: [
    {
      title: "Сложение и вычитание обыкновенных дробей",
      avg_mastery: 36,
      students_struggling: 4,
      avg_hints: 3.7,
      gave_up_count: 3
    },
    {
      title: "Сложение рациональных чисел с разными знаками",
      avg_mastery: 48,
      students_struggling: 3,
      avg_hints: 3.1,
      gave_up_count: 4
    },
    {
      title: "Формулы сокращённого умножения",
      avg_mastery: 62,
      students_struggling: 2,
      avg_hints: 2.2,
      gave_up_count: 1
    },
    {
      title: "Квадратные уравнения",
      avg_mastery: 76,
      students_struggling: 1,
      avg_hints: 1.4,
      gave_up_count: 0
    }
  ]
};
