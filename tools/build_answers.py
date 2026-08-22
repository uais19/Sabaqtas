#!/usr/bin/env python3
# build_answers.py — собирает заготовленные ответы для демо заранее, offline.
#
# Зачем: бесплатный тариф Gemini даёт всего 20 генераций в день на модель.
# Типовые вопросы демо можно ответить один раз сегодня и положить готовые
# ответы в файл — на самом демо они не потратят ни генерацию, ни эмбеддинг.
#
# Что делает скрипт:
#   1. читает tools/demo_questions.txt (режим | язык | класс | вопрос)
#   2. каждый вопрос задаёт РАЗВЁРНУТОМУ сайту через /api/ask
#   3. складывает ответы в frontend/api/answers.json под ключом заготовок
#      prebakedKey() из ask.js — вопрос|режим|язык, без класса
#
# Запуск:  python tools/build_answers.py
# Адрес сайта можно поменять переменной окружения SABAQTAS_URL.

import json
import os
import sys
import time

import requests


# --- Настройки ---------------------------------------------------------------

# Пути считаем от корня проекта, а не от текущей папки,
# поэтому скрипт можно запускать откуда угодно.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_PATH = os.path.join(ROOT, "tools", "demo_questions.txt")
OUTPUT_PATH = os.path.join(ROOT, "frontend", "api", "answers.json")

# Вопросы задаём развёрнутому сайту, а не локальному серверу: ответ должен
# пройти весь настоящий путь — порог, поиск фрагментов, генерацию.
API_URL = os.environ.get("SABAQTAS_URL", "https://sabaqtas.vercel.app/api/ask")

# Бесплатный тариф пускает 5 запросов в минуту. 15 секунд паузы между
# вопросами держат нас заведомо ниже этой границы.
PAUSE_BETWEEN_QUESTIONS = 15


# --- Ошибки ------------------------------------------------------------------

def fail(message):
    """Останавливаем скрипт с понятным сообщением, а не с трассировкой."""
    print("ОШИБКА: " + message, file=sys.stderr)
    sys.exit(1)


# --- Чтение списка вопросов ---------------------------------------------------

def read_questions(path):
    """Разбираем demo_questions.txt в список словарей."""
    if not os.path.exists(path):
        fail("нет файла " + path)

    questions = []
    with open(path, encoding="utf-8") as source:
        for line_number, raw_line in enumerate(source, start=1):
            line = raw_line.strip()
            # Пустые строки и комментарии пропускаем.
            if line == "" or line.startswith("#"):
                continue

            parts = [part.strip() for part in line.split("|")]
            if len(parts) != 4:
                fail("строка %d: ожидаю 4 поля через «|», получил %d" %
                     (line_number, len(parts)))

            mode, lang, grade, question = parts
            if mode not in ("explain", "mentor"):
                fail("строка %d: режим «%s» не бывает" % (line_number, mode))
            if lang not in ("ru", "kk"):
                fail("строка %d: язык «%s» не бывает" % (line_number, lang))
            if not grade.isdigit():
                fail("строка %d: класс «%s» не число" % (line_number, grade))
            if question == "":
                fail("строка %d: пустой вопрос" % line_number)

            questions.append({
                "mode": mode,
                "lang": lang,
                "grade": int(grade),
                "question": question
            })

    if not questions:
        fail("в " + path + " не нашлось ни одного вопроса")
    return questions


# --- Ключ ответа --------------------------------------------------------------

def cache_key(question, mode, lang):
    """Ключ собираем В ТОЧНОСТИ как prebakedKey() в ask.js: вопрос без
    пробелов по краям и в нижнем регистре, дальше режим и язык через «|».
    Класса в ключе НЕТ: он влияет только на тон ответа, а не на поиск,
    поэтому одна заготовка обслуживает любой класс."""
    return question.strip().lower() + "|" + mode + "|" + lang


# --- Основной ход -------------------------------------------------------------

def main():
    questions = read_questions(SOURCE_PATH)
    print("Вопросов в списке: %d, сайт: %s" % (len(questions), API_URL))

    answers = {}
    for index, item in enumerate(questions, start=1):
        # Печатаем вопрос, каким он прочитался из файла: если кодировка
        # сломалась, кракозябры будут видны сразу — до траты генерации.
        print("%d из %d: %s" % (index, len(questions), item["question"]))

        payload = {
            "question": item["question"],
            "mode": item["mode"],
            "lang": item["lang"],
            "grade": item["grade"]
        }

        # Кириллицу шлём как настоящий UTF-8, а не \uXXXX: однажды сломанная
        # кодировка уже стоила двух генераций впустую.
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            response = requests.post(
                API_URL,
                data=body,
                headers={"Content-Type": "application/json; charset=utf-8"},
                timeout=60
            )
        except requests.RequestException as error:
            fail("вопрос «%s»: сеть подвела (%s). Файл не записан." %
                 (item["question"], error))

        # Любой не-200 — стоп сразу. Половина файла хуже, чем никакого:
        # лучше запустить скрипт заново завтра, когда квота обновится.
        if response.status_code != 200:
            fail("вопрос «%s»: сайт ответил кодом %d: %s. Файл не записан." %
                 (item["question"], response.status_code, response.text[:200]))

        answer = response.json()
        key = cache_key(item["question"], item["mode"], item["lang"])
        # Два одинаковых ключа — это два вопроса, различавшихся только классом.
        # Молча перезаписать — значит потерять ответ; лучше упасть громко.
        if key in answers:
            fail("ключ «%s» встретился дважды — уберите дубль из demo_questions.txt" % key)
        answers[key] = answer

        # found: false — это тоже нормальный ответ («этого нет в учебниках»),
        # печатаем итог строки, чтобы ход сборки был виден.
        status = "ответ найден" if answer.get("found") else "честный отказ"
        print("   " + status)

        # Пауза после каждого вопроса, кроме последнего.
        if index < len(questions):
            time.sleep(PAUSE_BETWEEN_QUESTIONS)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as output:
        json.dump(answers, output, ensure_ascii=False, indent=2, sort_keys=True)

    print("Готово: %d ответов в %s" % (len(answers), OUTPUT_PATH))


if __name__ == "__main__":
    main()
