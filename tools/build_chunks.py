#!/usr/bin/env python3
# build_chunks.py — считает эмбеддинги для кусков учебника заранее, offline.
#
# Зачем offline: во время работы сайта функция на сервере считает эмбеддинг
# только для вопроса ученика, а векторы учебника уже лежат готовые в JSON.
# Так ответ приходит быстрее и запросов к платному API меньше.
#
# Что делает скрипт:
#   1. читает content/sample.txt
#   2. режет текст на куски по строкам, которые начинаются с ###
#   3. для каждого куска просит у Gemini эмбеддинг
#   4. складывает всё в frontend/api/chunks.json
#
# Запуск:  python tools/build_chunks.py
# Нужен ключ в переменной окружения GEMINI_API_KEY.

import json
import math
import os
import sys
import time

import requests


# --- Настройки ---------------------------------------------------------------

# Пути считаем от корня проекта, а не от текущей папки,
# поэтому скрипт можно запускать откуда угодно.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_PATH = os.path.join(ROOT, "content", "sample.txt")
OUTPUT_PATH = os.path.join(ROOT, "frontend", "api", "chunks.json")

MODEL = "gemini-embedding-2"
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":embedContent"

# Размер вектора. По умолчанию модель отдаёт длинный вектор, а нам нужен
# компактный: 768 чисел вместо тысяч — файл chunks.json остаётся маленьким,
# его быстрее скачивать и он спокойно едет вместе с деплоем.
OUTPUT_DIMENSIONALITY = 768

# Сколько знаков после запятой оставляем у чисел вектора.
# Полная точность float почти вдвое раздувает chunks.json, а на качество
# поиска не влияет: шестого знака для сравнения векторов хватает с запасом.
VECTOR_PRECISION = 6

# Сколько раз пробуем получить эмбеддинг одного куска.
MAX_ATTEMPTS = 4

# Паузы перед повторными попытками. Попыток 4, значит пауз между ними 3.
# Каждая следующая длиннее: если сервис перегружен, ему нужно время.
RETRY_DELAYS = [2, 4, 8]

# Небольшая пауза между кусками, чтобы на большом учебнике не упереться
# в ограничение бесплатного тарифа по числу запросов в минуту.
PAUSE_BETWEEN_CHUNKS = 0.3

# Метаданные в строке ### идут в этом порядке.
META_FIELDS = ["subject", "grade", "part", "paragraph", "page"]


# --- Ошибки ------------------------------------------------------------------

def fail(message):
    """Останавливаем скрипт с понятным сообщением, а не с трассировкой."""
    print("ОШИБКА: " + message, file=sys.stderr)
    sys.exit(1)


# --- Чтение и разбор исходного файла -----------------------------------------

def only_number(value, field_name, line_number):
    """Достаём число из строки вида «5 класс» или «стр. 45»."""
    digits = "".join(character for character in value if character.isdigit())
    if not digits:
        fail("строка %d: в поле «%s» нет числа (получено «%s»)" % (line_number, field_name, value))
    return int(digits)


def parse_chunks(text):
    """Режем текст на куски. Каждый кусок — строка ### и абзац под ней."""
    chunks = []
    current = None
    preamble = []

    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip()

        if line.startswith("###"):
            # Начался новый кусок — предыдущий закрываем.
            if current is not None:
                chunks.append(current)

            # «### Математика | 5 класс | часть 1 | §12 | стр. 45»
            # или с пометкой «| placeholder» в конце — тестовый кусок.
            meta_line = line.lstrip("#").strip()
            parts = [piece.strip() for piece in meta_line.split("|")]

            # Пометка «placeholder» живёт в метаданных, а НЕ в тексте куска:
            # текст уходит модели, и предупреждение «тестовый текст» внутри
            # него модель читает как «материал ненастоящий» и отказывается
            # отвечать там, где должна ответить.
            is_placeholder = False
            if len(parts) == len(META_FIELDS) + 1:
                if parts[-1].lower() != "placeholder":
                    fail("строка %d: шестое поле может быть только «placeholder», а найдено «%s»"
                         % (line_number, parts[-1]))
                is_placeholder = True
                parts = parts[:-1]

            if len(parts) != len(META_FIELDS):
                fail("строка %d: ожидалось %d полей через «|», а найдено %d:\n  %s"
                     % (line_number, len(META_FIELDS), len(parts), line))

            current = {
                "text": "",
                "subject": parts[0],
                # класс и страница — числа: по ним потом удобно фильтровать
                "grade": only_number(parts[1], "класс", line_number),
                "part": parts[2],
                "paragraph": parts[3],
                "page": only_number(parts[4], "страница", line_number),
                "is_placeholder": is_placeholder,
            }
            continue

        if current is None:
            # Текст до первой строки ### — скорее всего файл оформлен неверно.
            if line:
                preamble.append(line)
            continue

        # Обычная строка текста: приклеиваем к текущему куску.
        if line:
            current["text"] = (current["text"] + " " + line).strip()

    if current is not None:
        chunks.append(current)

    if preamble:
        print("Внимание: текст до первой строки ### пропущен (%d строк)." % len(preamble))

    # Кусок без текста бесполезен: эмбеддинг считать не от чего.
    for chunk in chunks:
        if not chunk["text"]:
            fail("у куска «%s %s» нет текста под строкой ###"
                 % (chunk["subject"], chunk["paragraph"]))

    return chunks


# --- Обращение к Gemini ------------------------------------------------------

def read_values(response):
    """Достаём сам вектор из удачного ответа Gemini."""
    try:
        data = response.json()
    except ValueError:
        fail("Gemini вернул не JSON:\n%s" % response.text.strip())

    values = data.get("embedding", {}).get("values")
    if not values:
        fail("в ответе Gemini нет поля embedding.values:\n%s" % json.dumps(data, ensure_ascii=False))

    if len(values) != OUTPUT_DIMENSIONALITY:
        print("Внимание: ожидали вектор из %d чисел, а пришло %d."
              % (OUTPUT_DIMENSIONALITY, len(values)))

    return values


def fetch_embedding(text, api_key, chunk_number):
    """Просим у Gemini вектор для одного куска текста.

    Временные сбои (превышен лимит запросов, сервис недоступен, оборвалась
    связь) не должны рушить сборку целого учебника, поэтому такие запросы
    повторяем. Ошибки, которые повтором не лечатся, — неверный ключ или
    неизвестная модель — останавливают скрипт сразу.
    """
    payload = {
        "model": "models/" + MODEL,
        "content": {"parts": [{"text": text}]},
        # RETRIEVAL_DOCUMENT — этот текст лежит в базе и его будут искать.
        # Для вопроса ученика на сервере нужен RETRIEVAL_QUERY.
        "taskType": "RETRIEVAL_DOCUMENT",
        "outputDimensionality": OUTPUT_DIMENSIONALITY,
    }

    # Ключ передаём заголовком, а не в адресе страницы:
    # так он не попадёт в логи сервера и в историю запросов.
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = requests.post(API_URL, json=payload, headers=headers, timeout=60)
        except requests.exceptions.RequestException as error:
            problem = "нет связи с Gemini (%s)" % error
        else:
            if response.status_code == 200:
                return read_values(response)

            # 429 — слишком много запросов, 5xx — сбой на стороне Gemini.
            # И то и другое обычно проходит само, поэтому пробуем ещё раз.
            if response.status_code == 429 or response.status_code >= 500:
                problem = "Gemini ответил кодом %d" % response.status_code
            else:
                # Показываем ответ сервера целиком — в нём написана причина
                # отказа (неверный ключ, неизвестная модель, плохой запрос).
                fail("кусок %d: Gemini ответил кодом %d, повтор не поможет:\n%s"
                     % (chunk_number, response.status_code, response.text.strip()))

        if attempt < MAX_ATTEMPTS:
            delay = RETRY_DELAYS[attempt - 1]
            print("      кусок %d: %s. Повтор через %d с (попытка %d из %d)."
                  % (chunk_number, problem, delay, attempt + 1, MAX_ATTEMPTS))
            time.sleep(delay)

    fail("кусок %d: %s. Не удалось получить эмбеддинг за %d попытки — сборка остановлена."
         % (chunk_number, problem, MAX_ATTEMPTS))


# --- Подготовка вектора к записи ---------------------------------------------

def normalize_vector(values):
    """Приводим вектор к длине 1.

    Gemini отдаёт ненормированные векторы, когда outputDimensionality меньше
    родного размера модели. Без нормировки на ранжирование влияет длина
    вектора, а не только направление: длинный кусок текста получает
    преимущество просто потому, что у него больше числа. Поиск при этом
    работает «чуть неправильно» — не ломается заметно, а тихо выдаёт не тот
    параграф, и найти такую ошибку потом очень тяжело.

    Когда все векторы длины 1, скалярное произведение равно косинусной мере.
    Значит серверной функции достаточно перемножить и сложить числа —
    делить на длины во время работы сайта уже не нужно.
    """
    length = math.sqrt(sum(value * value for value in values))
    if length == 0:
        fail("Gemini вернул вектор из одних нулей — нормировать его нельзя")
    return [value / length for value in values]


def round_vector(values):
    """Оставляем шесть знаков после запятой: файл меньше, качество то же."""
    return [round(value, VECTOR_PRECISION) for value in values]


# --- Основной сценарий -------------------------------------------------------

def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        fail("не задана переменная окружения GEMINI_API_KEY.\n"
             "       Windows PowerShell:  $env:GEMINI_API_KEY = \"ваш-ключ\"\n"
             "       Linux и macOS:       export GEMINI_API_KEY=\"ваш-ключ\"")

    if not os.path.exists(SOURCE_PATH):
        fail("не найден исходный файл %s" % SOURCE_PATH)

    with open(SOURCE_PATH, encoding="utf-8") as source_file:
        text = source_file.read()

    chunks = parse_chunks(text)
    if not chunks:
        fail("в файле %s не нашлось ни одного куска (нет строк, начинающихся с ###)" % SOURCE_PATH)

    print("Файл: %s" % SOURCE_PATH)
    print("Найдено кусков: %d" % len(chunks))
    print("Модель: %s, размер вектора: %d" % (MODEL, OUTPUT_DIMENSIONALITY))
    print("")

    for number, chunk in enumerate(chunks, start=1):
        print("[%d/%d] %s, %s класс, %s, стр. %s — %d символов"
              % (number, len(chunks), chunk["subject"], chunk["grade"],
                 chunk["paragraph"], chunk["page"], len(chunk["text"])))

        values = fetch_embedding(chunk["text"], api_key, number)
        # Сначала нормируем, потом округляем: если сделать наоборот,
        # округление немного собьёт только что выставленную длину.
        chunk["embedding"] = round_vector(normalize_vector(values))

        # Пауза нужна только между запросами, после последнего она бессмысленна.
        if number < len(chunks):
            time.sleep(PAUSE_BETWEEN_CHUNKS)

    # Папки frontend/api может ещё не быть — создаём.
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    # Пишем без отступов: файл читает программа, а лишние пробелы
    # заметно раздувают размер из-за тысяч чисел.
    with open(OUTPUT_PATH, "w", encoding="utf-8") as output_file:
        json.dump(chunks, output_file, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024

    print("")
    print("Готово.")
    print("  кусков:      %d" % len(chunks))
    print("  файл:        %s" % OUTPUT_PATH)
    print("  размер:      %.1f КБ" % size_kb)

    # Громкое напоминание: заглушки не должны дожить до показа жюри.
    placeholder_count = sum(1 for chunk in chunks if chunk["is_placeholder"])
    if placeholder_count > 0:
        print("")
        print("!" * 60)
        print("!!! ВНИМАНИЕ: %d из %d кусков — тестовые заглушки (placeholder)."
              % (placeholder_count, len(chunks)))
        print("!!! Замените их настоящим текстом учебника и соберите заново.")
        print("!" * 60)


if __name__ == "__main__":
    main()
