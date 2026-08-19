// rotator.js — в заголовке по очереди меняется название предмета.

const ROTATOR_WORDS = ["математике", "физике", "химии"];
const ROTATOR_STEP = 2500; // как часто менять слово, мс
const ROTATOR_FADE = 300;  // сколько длится угасание, мс — столько же в CSS

const rotator = document.getElementById("rotator");

// При просьбе уменьшить анимацию слово не меняем: в заголовке
// остаётся «математике», как и написано в HTML.
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
