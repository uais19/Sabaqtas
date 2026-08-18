// menu.js — мобильное меню: открытие, закрытие и блокировка прокрутки страницы.

const burger = document.querySelector(".burger");
const overlay = document.querySelector(".menu-overlay");
const panel = document.querySelector(".menu-panel");

// Всё состояние меню — это один класс "menu-open" на <body>.
// От него в CSS зависят сразу три вещи: выезжающая панель, затемнение
// и крестик вместо трёх полосок. В JS больше ничего менять не нужно.
function setMenu(isOpen) {
  document.body.classList.toggle("menu-open", isOpen);
  // aria-expanded нужен программе чтения с экрана: она сообщит,
  // раскрыто меню или нет.
  burger.setAttribute("aria-expanded", isOpen);
}

// Клик по бургеру переключает меню: открыто -> закрыто и наоборот.
burger.addEventListener("click", () => {
  setMenu(!document.body.classList.contains("menu-open"));
});

// Клик по затемнению — закрыть.
overlay.addEventListener("click", () => {
  setMenu(false);
});

// Клик по любой ссылке внутри панели — закрыть,
// иначе панель закроет собой раздел, к которому мы только что перешли.
// closest("a") ловит клик и по самой ссылке, и по тексту внутри неё.
panel.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});

// Escape — закрыть. Привычный способ выйти из любого всплывающего окна.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});
