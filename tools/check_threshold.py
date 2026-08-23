#!/usr/bin/env python3
# check_threshold.py — замеряет, правильно ли выбран порог отсечения.
#
# Зачем нужен:
#   В frontend/api/ask.js есть число SIMILARITY_THRESHOLD = 0.6. Если лучший
#   кусок учебника похож на вопрос меньше, чем на это число, сайт отвечает
#   «Этого нет в загруженных учебниках» и не вызывает модель вообще.
#   Число подобрано под текущий набор фрагментов. Стоит добавить учебники —
#   и его нужно перепроверить. Этот скрипт показывает настоящие числа.
#
# Что делает:
#   1. читает frontend/api/chunks.json (векторы кусков уже готовы)
#   2. читает tools/threshold_questions.txt — вопросы с метками in / out
#   3. для каждого вопроса просит у Gemini вектор ТОЧНО так же, как это
#      делает сайт: taskType RETRIEVAL_QUERY, 768 чисел, нормировка
#   4. считает похожесть тем же скалярным произведением, что и ask.js
#   5. печатает таблицу и говорит, какой порог безопасен
#
# Генеративную модель НЕ трогает совсем — тратится только квота эмбеддингов,
# а она отдельная от квоты на ответы.
#
# Запуск:  python tools/check_threshold.py
# Нужен ключ в переменной окружения GEMINI_API_KEY.

import json
import math
import os
import sys
import time

import requests


# --- Настройки ---------------------------------------------------------------

# Пути считаем от корня проекта, чтобы скрипт запускался откуда угодно.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHUNKS_PATH = os.path.join(ROOT, "frontend", "api", "chunks.json")
QUESTIONS_PATH = os.path.join(ROOT, "tools", "threshold_questions.txt")
# Сюда складываем ВСЕ числа похожести: каждый вопрос против каждого куска.
# Нужно, чтобы потом подбирать правило отсечения (tools/tune_rule.py)
# сколько угодно раз, не обращаясь к Gemini заново.
SCORES_PATH = os.path.join(ROOT, "tools", "threshold_scores.json")

# Всё ниже должно совпадать с frontend/api/ask.js. Если там поменяется —
# менять и здесь, иначе замер будет врать.
MODEL = "gemini-embedding-2"
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":embedContent"
OUTPUT_DIMENSIONALITY = 768
CURRENT_THRESHOLD = 0.6

MAX_ATTEMPTS = 4
RETRY_DELAYS = [2, 4, 8]
PAUSE_BETWEEN_QUESTIONS = 0.3


def fail(message):
    """Останавливаем скрипт с понятным сообщением, а не с трассировкой."""
    print("ОШИБКА: " + message, file=sys.stderr)
    sys.exit(1)


# --- Чтение входных файлов ---------------------------------------------------

def read_questions(path):
    """Разбираем файл вопросов. Возвращаем список пар (метка, вопрос)."""
    if not os.path.exists(path):
        fail("не найден файл вопросов %s" % path)

    questions = []
    with open(path, encoding="utf-8") as source:
        for line_number, raw_line in enumerate(source, start=1):
            line = raw_line.strip()
            # Пустые строки и комментарии пропускаем.
            if not line or line.startswith("#"):
                continue
            if "|" not in line:
                fail("строка %d: нет разделителя «|» (получено «%s»)" % (line_number, line))
            label, question = line.split("|", 1)
            label = label.strip().lower()
            question = question.strip()
            if label not in ("in", "out"):
                fail("строка %d: метка должна быть in или out, получено «%s»" % (line_number, label))
            if not question:
                fail("строка %d: пустой вопрос" % line_number)
            questions.append((label, question))

    if not questions:
        fail("в файле %s нет ни одного вопроса" % path)
    return questions


def read_chunks(path):
    """Читаем куски учебника вместе с готовыми векторами."""
    if not os.path.exists(path):
        fail("не найден %s — сначала запусти tools/build_chunks.py" % path)

    with open(path, encoding="utf-8") as source:
        chunks = json.load(source)

    if not chunks:
        fail("в %s нет ни одного куска" % path)
    return chunks


# --- Векторы -----------------------------------------------------------------

def normalize(vector):
    """Приводим вектор к длине 1 — как функция normalize в ask.js."""
    length = math.sqrt(sum(value * value for value in vector))
    if not length:
        return vector
    return [value / length for value in vector]


def dot_product(left, right):
    """Скалярное произведение. Для векторов длины 1 это косинусная похожесть."""
    return sum(a * b for a, b in zip(left, right))


def embed_question(question, api_key):
    """Просим у Gemini вектор вопроса. Повторяем при временных сбоях."""
    payload = {
        "model": "models/" + MODEL,
        "content": {"parts": [{"text": question}]},
        # RETRIEVAL_QUERY — тип «вопрос, которым ищут». Куски учебника
        # считались с парным типом RETRIEVAL_DOCUMENT. Типы должны быть
        # разными, иначе числа похожести поедут.
        "taskType": "RETRIEVAL_QUERY",
        "outputDimensionality": OUTPUT_DIMENSIONALITY,
    }

    last_error = ""
    for attempt in range(MAX_ATTEMPTS):
        try:
            response = requests.post(
                API_URL,
                params={"key": api_key},
                json=payload,
                timeout=30,
            )
        except requests.RequestException as error:
            last_error = "сеть: %s" % error
        else:
            if response.status_code == 200:
                return normalize(response.json()["embedding"]["values"])
            last_error = "код %d: %s" % (response.status_code, response.text[:200])
            # 400 и 404 повтором не лечатся — это ошибка в запросе или имени модели.
            if response.status_code in (400, 403, 404):
                fail("вопрос «%s» — %s" % (question, last_error))

        if attempt < len(RETRY_DELAYS):
            time.sleep(RETRY_DELAYS[attempt])

    fail("вопрос «%s»: не удалось получить вектор за %d попыток. %s"
         % (question, MAX_ATTEMPTS, last_error))


# --- Подсчёт -----------------------------------------------------------------

def all_scores(question_vector, chunks):
    """Похожесть вопроса на КАЖДЫЙ кусок — как шаг 2 в ask.js.

    ask.js берёт из этого списка только максимум, но нам для подбора
    правила нужны все числа: по ним видно, выделяется ли один кусок
    на фоне остальных или все похожи одинаково.
    """
    return [dot_product(question_vector, chunk["embedding"]) for chunk in chunks]


def best_match(scores, chunks):
    """Самый похожий кусок и его число похожести."""
    best_index = max(range(len(scores)), key=lambda index: scores[index])
    return scores[best_index], chunks[best_index]


def describe(chunk):
    """Короткая подпись куска: «Алгебра 8 класс §6».

    Поле paragraph в chunks.json уже хранится вместе со знаком §
    (например «§21»), поэтому второй раз его дописывать не нужно.
    """
    if chunk is None:
        return "—"
    return "%s %s класс %s" % (chunk.get("subject", "?"), chunk.get("grade", "?"), chunk.get("paragraph", "?"))


def main():
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        fail("нет переменной окружения GEMINI_API_KEY")

    chunks = read_chunks(CHUNKS_PATH)
    questions = read_questions(QUESTIONS_PATH)

    print("Кусков учебника: %d" % len(chunks))
    print("Вопросов на замер: %d" % len(questions))
    print("Текущий порог в ask.js: %.2f" % CURRENT_THRESHOLD)
    print("Запросов к Gemini будет %d — только эмбеддинги, генерация не вызывается.\n" % len(questions))

    results = []
    dump = []
    for index, (label, question) in enumerate(questions, start=1):
        print("  [%d/%d] %s" % (index, len(questions), question), flush=True)
        vector = embed_question(question, api_key)
        scores = all_scores(vector, chunks)
        score, chunk = best_match(scores, chunks)
        results.append((label, question, score, chunk))
        # Округляем до шестого знака: полная точность float раздувает файл,
        # а на подбор правила шестого знака хватает с запасом.
        dump.append({"label": label, "question": question,
                     "scores": [round(value, 6) for value in scores]})
        time.sleep(PAUSE_BETWEEN_QUESTIONS)

    # Сохраняем числа СРАЗУ после опроса — до печати таблиц. Если ниже
    # что-то упадёт, квота уже потрачена, и терять результат обидно.
    with open(SCORES_PATH, "w", encoding="utf-8") as target:
        json.dump({"chunks": [describe(chunk) for chunk in chunks], "questions": dump},
                  target, ensure_ascii=False, indent=1)
    print("\nВсе числа сохранены в %s" % SCORES_PATH)

    inside = [item for item in results if item[0] == "in"]
    outside = [item for item in results if item[0] == "out"]

    # --- Таблица по своим вопросам ---
    print("\n" + "=" * 78)
    print("СВОИ вопросы — должны проходить порог")
    print("=" * 78)
    for _, question, score, chunk in sorted(inside, key=lambda item: item[2]):
        mark = "OK     " if score >= CURRENT_THRESHOLD else "ОТСЕЧЁН"
        print("  %.3f  %s  %-52s %s" % (score, mark, question[:52], describe(chunk)))

    # --- Таблица по чужим вопросам ---
    print("\n" + "=" * 78)
    print("ЧУЖИЕ вопросы — должны отсекаться")
    print("=" * 78)
    for _, question, score, chunk in sorted(outside, key=lambda item: -item[2]):
        mark = "ПРОЛЕЗ " if score >= CURRENT_THRESHOLD else "OK     "
        print("  %.3f  %s  %-52s %s" % (score, mark, question[:52], describe(chunk)))

    # --- Итог ---
    min_inside = min(item[2] for item in inside)
    max_outside = max(item[2] for item in outside)
    broken_inside = [item for item in inside if item[2] < CURRENT_THRESHOLD]
    broken_outside = [item for item in outside if item[2] >= CURRENT_THRESHOLD]

    print("\n" + "=" * 78)
    print("ИТОГ")
    print("=" * 78)
    print("  Самый слабый СВОЙ вопрос:  %.3f" % min_inside)
    print("  Самый сильный ЧУЖОЙ вопрос: %.3f" % max_outside)
    print("  Зазор между ними: %+.3f" % (min_inside - max_outside))
    print()

    if broken_inside:
        print("  ПРОБЛЕМА: %d своих вопросов отсекаются — ученик получит «этого нет в учебниках»"
              % len(broken_inside))
        for _, question, score, _ in broken_inside:
            print("      %.3f  %s" % (score, question))
    if broken_outside:
        print("  ПРОБЛЕМА: %d чужих вопросов пролезают — ИИ будет отвечать по памяти, не по учебнику"
              % len(broken_outside))
        for _, question, score, _ in broken_outside:
            print("      %.3f  %s" % (score, question))
    if not broken_inside and not broken_outside:
        print("  Порог %.2f разделяет вопросы правильно: своих не режет, чужих не пускает." % CURRENT_THRESHOLD)

    print()
    if min_inside > max_outside:
        # Есть чистый коридор — ставим порог посередине, так запас с обеих сторон одинаковый.
        middle = (min_inside + max_outside) / 2
        print("  Безопасный коридор порога: от %.3f до %.3f" % (max_outside + 0.001, min_inside))
        print("  Середина коридора: %.3f — самый устойчивый вариант." % middle)
        if middle - max_outside < 0.03:
            print("  Но коридор узкий. Одна неудачная формулировка вопроса — и порог промахнётся.")
    else:
        print("  Чистого коридора НЕТ: есть чужой вопрос, похожий на учебник сильнее,")
        print("  чем самый слабый свой. Одним числом эти две группы не разделить.")
        print("  Это не повод паниковать — значит, надо либо переформулировать")
        print("  спорные вопросы в списке, либо добавить в учебники недостающий кусок.")


if __name__ == "__main__":
    main()
