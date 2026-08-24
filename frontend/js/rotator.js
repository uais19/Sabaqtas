// rotator.js — в заголовке по очереди меняется тема.
//
// Слова — только те темы, которые реально лежат в корпусе учебников и в
// цепочке диагностики. Раньше здесь крутились «физике» и «химии», которых
// в продукте нет: заголовок обещал три предмета, а работал один.

// Слова берём через t(): в казахском фраза строится через тире, и слово
// стоит в именительном падеже, а не в предложном, как в русском.
const ROTATOR_WORDS = [
  t("landing.rotator1", "дробях"),
  t("landing.rotator2", "уравнениях"),
  t("landing.rotator3", "формулах")
];
const ROTATOR_STEP = 2500; // как часто менять слово, мс
const ROTATOR_FADE = 300;  // сколько длится угасание, мс — столько же в CSS

const rotator = document.getElementById("rotator");

// В разметке лежит русское слово — на казахском подменяем его сразу,
// не дожидаясь первого поворота через 2.5 секунды.
if (rotator) {
  rotator.textContent = ROTATOR_WORDS[0];
}

// При просьбе уменьшить анимацию слово не меняем: в заголовке
// остаётся «дробях», как и написано в HTML.
const rotatorReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (rotator && !rotatorReduceMotion) {
  let wordIndex = 0;

  setInterval(() => {
    // Шаг 1: слово гаснет и чуть уезжает вверх (класс включает переход в CSS).
    rotator.classList.add("is-hiding");

    // Шаг 2: когда угасание закончилось, подменяем текст и убираем класс —
    // новое слово проявляется тем же переходом обратно.
    setTimeout(() => {
      wordIndex = (wordIndex + 1) % ROTATOR_WORDS.length;
      rotator.textContent = ROTATOR_WORDS[wordIndex];
      rotator.classList.remove("is-hiding");
    }, ROTATOR_FADE);
  }, ROTATOR_STEP);
}
