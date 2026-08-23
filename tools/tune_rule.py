#!/usr/bin/env python3
# tune_rule.py — подбирает правило отсечения по уже посчитанным числам.
#
# Зачем нужен:
#   Замер показал, что одним порогом «свои» и «чужие» вопросы не разделяются:
#   чужой вопрос про системы уравнений набрал 0.664, а свой про сложение
#   дробей — 0.647. Любое одно число либо режет своих, либо пускает чужих.
#
#   Но у нас есть второй признак. Если вопрос действительно по теме
#   параграфа, ОДИН кусок учебника выделяется на фоне остальных. Если
#   вопрос просто «вообще про математику», все куски похожи примерно
#   одинаково, и ни один не выделяется. Абсолютное число врёт, отрыв — нет.
#
#   Этот скрипт проверяет три способа мерить отрыв и говорит, какой из них
#   разделяет вопросы чисто и какое число ставить.
#
# Что НЕ делает: не обращается к Gemini вообще. Читает tools/threshold_scores.json,
# который сохранил check_threshold.py. Гонять можно сколько угодно раз бесплатно.
#
# Запуск:  python tools/tune_rule.py

import json
import os
import sys


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCORES_PATH = os.path.join(ROOT, "tools", "threshold_scores.json")

# Базовый порог из frontend/api/ask.js. Он остаётся на месте: своих вопросов
# он не режет (самый слабый — 0.647), и он же отсекает вопросы совсем не по
# теме. Правило отрыва добавляется вторым условием, а не вместо него.
BASE_THRESHOLD = 0.6


def fail(message):
    print("ОШИБКА: " + message, file=sys.stderr)
    sys.exit(1)


# --- Три способа померить отрыв ----------------------------------------------
#
# Каждая функция получает список чисел похожести вопроса на все куски
# и возвращает одно число — насколько лучший кусок оторвался от остальных.

def gap_from_average(scores):
    """Лучший минус среднее по всем кускам.

    Самый устойчивый: среднее считается по всем 30 числам, поэтому один
    случайно похожий кусок его почти не сдвигает.
    """
    best = max(scores)
    average = sum(scores) / len(scores)
    return best - average


def gap_from_second(scores):
    """Лучший минус второй по величине.

    Самый строгий. Плохо работает, когда тема разбита на несколько кусков
    подряд: два соседних куска одного параграфа законно похожи друг на друга,
    и отрыв получится маленьким у совершенно правильного вопроса.
    """
    ordered = sorted(scores, reverse=True)
    return ordered[0] - ordered[1]


def gap_from_tail(scores):
    """Лучший минус среднее по кускам с шестого места и ниже.

    Компромисс: соседние куски той же темы (они обычно в первой пятёрке)
    в расчёт не идут, а фон по остальным считается честно.
    """
    ordered = sorted(scores, reverse=True)
    tail = ordered[5:]
    if not tail:
        return ordered[0] - (sum(ordered[1:]) / len(ordered[1:]))
    return ordered[0] - (sum(tail) / len(tail))


RULES = [
    ("отрыв от среднего по всем кускам", gap_from_average),
    ("отрыв от второго места", gap_from_second),
    ("отрыв от среднего по хвосту (с 6 места)", gap_from_tail),
]


def main():
    if not os.path.exists(SCORES_PATH):
        fail("не найден %s — сначала запусти python tools/check_threshold.py" % SCORES_PATH)

    with open(SCORES_PATH, encoding="utf-8") as source:
        data = json.load(source)

    questions = data["questions"]
    inside = [item for item in questions if item["label"] == "in"]
    outside = [item for item in questions if item["label"] == "out"]
    if not inside or not outside:
        fail("в дампе должны быть вопросы обоих видов: in и out")

    print("Вопросов: своих %d, чужих %d. Кусков учебника: %d."
          % (len(inside), len(outside), len(data["chunks"])))
    print("Базовый порог остаётся %.2f, подбираем второе условие.\n" % BASE_THRESHOLD)

    # Чужие вопросы, которые базовый порог и так отсекает, в подборе не участвуют:
    # правило отрыва про них ничего решать не должно.
    survivors = [item for item in outside if max(item["scores"]) >= BASE_THRESHOLD]
    print("Чужих вопросов, пролезающих через базовый порог: %d из %d — их и надо отсечь отрывом.\n"
          % (len(survivors), len(outside)))
    if not survivors:
        print("Отсекать нечего: базовый порог справляется сам. Правило отрыва не нужно.")
        return

    best_rule = None

    for title, measure in RULES:
        in_gaps = sorted((measure(item["scores"]), item["question"]) for item in inside)
        out_gaps = sorted(((measure(item["scores"]), item["question"]) for item in survivors),
                          reverse=True)

        weakest_in = in_gaps[0][0]
        strongest_out = out_gaps[0][0]
        corridor = weakest_in - strongest_out

        print("=" * 78)
        print(title.upper())
        print("=" * 78)
        print("  Самый слабый отрыв у СВОЕГО вопроса:  %.3f  (%s)" % (weakest_in, in_gaps[0][1][:48]))
        print("  Самый сильный отрыв у ЧУЖОГО вопроса: %.3f  (%s)" % (strongest_out, out_gaps[0][1][:48]))
        print("  Зазор: %+.3f" % corridor)

        if corridor > 0:
            middle = (weakest_in + strongest_out) / 2
            print("  РАЗДЕЛЯЕТ. Ставить отрыв %.3f — ровно посередине зазора." % middle)
            if best_rule is None or corridor > best_rule[0]:
                best_rule = (corridor, title, middle, measure)
        else:
            print("  НЕ разделяет: есть чужой вопрос с отрывом больше, чем у своего.")
        print()

    print("=" * 78)
    print("ВЫВОД")
    print("=" * 78)

    if best_rule is None:
        print("  Ни один из трёх способов не разделяет вопросы чисто.")
        print("  Правило отрыва задачу не решает — надо смотреть вариант с названиями тем.")
        return

    corridor, title, middle, measure = best_rule
    print("  Лучший способ: %s" % title)
    print("  Порог отрыва: %.3f, зазор %.3f" % (middle, corridor))
    print()
    print("  Полное правило для ask.js:")
    print("    пройти, если  лучший >= %.2f  И  отрыв >= %.3f" % (BASE_THRESHOLD, middle))
    print()

    # Проверяем правило целиком на всех вопросах — так же, как это будет
    # работать в ask.js. Это страховка от ошибки в рассуждении выше.
    def passes(item):
        return max(item["scores"]) >= BASE_THRESHOLD and measure(item["scores"]) >= middle

    wrongly_cut = [item for item in inside if not passes(item)]
    wrongly_let = [item for item in outside if passes(item)]

    print("  Проверка правила на всех %d вопросах:" % len(questions))
    print("    своих отсечено по ошибке: %d" % len(wrongly_cut))
    for item in wrongly_cut:
        print("        %s" % item["question"])
    print("    чужих пропущено по ошибке: %d" % len(wrongly_let))
    for item in wrongly_let:
        print("        %s" % item["question"])

    if not wrongly_cut and not wrongly_let:
        print("\n  Ошибок нет: правило разделяет все 38 вопросов правильно.")


if __name__ == "__main__":
    main()
