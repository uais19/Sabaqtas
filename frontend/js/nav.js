// nav.js — подсвечивает ссылку на ту секцию, которую сейчас видно.
// Ссылки ищем по атрибуту data-nav, а не по месту в шапке. Поэтому один
// наблюдатель подсвечивает сразу оба меню: и верхнее, и мобильное.

const navLinks = document.querySelectorAll("[data-nav]");

// Секции берём из самой страницы, поэтому они идут сверху вниз в нужном
// порядке. Оставляем только те, на которые есть ссылка в меню.
const sections = [...document.querySelectorAll("main section[id]")].filter(
  (section) => document.querySelector('[data-nav="' + section.id + '"]')
);

// Сюда складываем id секций, которые сейчас попали в полосу наблюдения.
const visibleIds = new Set();

// IntersectionObserver сам сообщает, когда секция входит в полосу и выходит из неё.
// Позицию прокрутки вручную считать не нужно — это делает браузер.
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) visibleIds.add(entry.target.id);
    else visibleIds.delete(entry.target.id);
  });

  // В полосу могут попасть сразу две секции. Активной делаем верхнюю:
  // массив sections идёт в порядке страницы, поэтому берём первую найденную.
  const current = sections.find((section) => visibleIds.has(section.id));
  if (!current) return; // между секциями подсветку не снимаем

  // Класс получают все ссылки на текущую секцию — и в шапке, и в меню.
  // У остальных ссылок класс снимается, поэтому активная секция всегда одна.
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === current.id);
  });
}, {
  // Полоса наблюдения — горизонтальная лента в верхней трети экрана
  // (от 20% до 50% высоты, то есть заведомо ниже липкой шапки).
  // Границу полосы специально не совмещаем с краем шапки: иначе конец
  // предыдущей секции касается полосы и подсветка отстаёт на один пункт.
  rootMargin: "-20% 0px -50% 0px"
});

sections.forEach((section) => observer.observe(section));
