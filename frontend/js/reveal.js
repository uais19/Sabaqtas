// reveal.js — элементы появляются, когда доходят до экрана при прокрутке.
//
// Важно: сам этот файл ничего не прячет. Скрытое состояние задаёт CSS
// правилом html.js-reveal .reveal, а класс js-reveal ставит короткий скрипт
// в <head>. Поэтому при выключенном JavaScript текст просто виден целиком.

// Если человек попросил систему уменьшить анимацию, ничего не делаем:
// CSS в этом случае и не прячет элементы, они видны сразу.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  const revealItems = document.querySelectorAll(".reveal");

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      // Элемент появляется один раз и дальше остаётся видимым,
      // поэтому снимаем его с наблюдения.
      revealObserver.unobserve(entry.target);
    });
  }, {
    // Нижнюю границу поднимаем: элемент появляется, когда он уже
    // немного зашёл на экран, а не в тот момент, когда показался край.
    rootMargin: "0px 0px -10% 0px"
  });

  revealItems.forEach((item) => {
    // Соседи по блоку — например три карточки в одной секции.
    // Каждый следующий ждёт на 80 мс дольше, поэтому они появляются
    // друг за другом, а не все разом.
    const neighbours = [...item.parentElement.children].filter(
      (child) => child.classList.contains("reveal")
    );
    item.style.transitionDelay = neighbours.indexOf(item) * 80 + "ms";
    revealObserver.observe(item);
  });
}
