// login.js — экран входа: анкета ученика и демо-вход для жюри.
//
// Никаких запросов к серверу: профиль живёт в localStorage браузера.
// Пароль в открытом виде не храним никогда — только его SHA-256 отпечаток.

// --- Элементы страницы ---

const form = document.getElementById("login-form");
const nameInput = document.getElementById("login-name");
const passInput = document.getElementById("login-pass");
const gradeSelect = document.getElementById("login-grade");
const subjectSelect = document.getElementById("login-subject");
const levelSelect = document.getElementById("login-level");
const goalSelect = document.getElementById("login-goal");
const deadlineInput = document.getElementById("login-deadline");
const errorBox = document.getElementById("error");

// --- Сообщение об ошибке ---

function showError(text) {
  errorBox.textContent = text;
  errorBox.classList.remove("is-hidden");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.add("is-hidden");
}

// --- Хранение профиля ---

// Любое обращение к localStorage — через try/catch: в приватном режиме
// браузера он бросает исключение, а экран из-за этого падать не должен.
function saveProfile(profile) {
  try {
    localStorage.setItem("sabaqtas-profile", JSON.stringify(profile));
    return true;
  } catch (error) {
    // Сохранить не вышло — идём дальше без профиля, это не повод останавливать
    // человека на пороге. Причина остаётся в консоли.
    console.log("Не удалось сохранить профиль: " + error.message);
    return true;
  }
}

// --- Пароль ---

// SHA-256 через встроенный crypto.subtle. Возвращаем хеш строкой из
// 64 шестнадцатеричных символов. Сам пароль после этого нигде не живёт.
async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  // ArrayBuffer -> массив байтов -> шестнадцатеричная строка.
  return Array.from(new Uint8Array(digest))
    .map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    })
    .join("");
}

// --- Отправка анкеты ---

async function submitForm(event) {
  // Форму обрабатываем сами, перезагрузка страницы не нужна.
  event.preventDefault();
  hideError();

  const name = nameInput.value.trim();
  if (name === "") {
    showError(t("login.errorName", "Введи имя"));
    return;
  }

  const password = passInput.value;
  if (password.length < 4) {
    showError(t("login.errorPassword", "Пароль от 4 символов"));
    return;
  }

  // crypto.subtle работает только в защищённом окружении (https или
  // localhost). Открытый файлом с диска сайт хеш посчитать не сможет —
  // честно говорим об этом, а НЕ сохраняем пароль в открытом виде.
  let passHash;
  try {
    passHash = await hashPassword(password);
  } catch (error) {
    showError(t("login.errorHttps", "Регистрация работает только по https. Открой сайт по ссылке, а не файлом с диска."));
    return;
  }

  saveProfile({
    name: name,
    passHash: passHash,
    grade: Number(gradeSelect.value),
    subject: subjectSelect.value,
    level: levelSelect.value,
    goal: goalSelect.value,
    // Поле type="date" само отдаёт либо "YYYY-MM-DD", либо пустую строку,
    // если дату не ввели. Дополнительно ничего не проверяем.
    deadline: deadlineInput.value,
    role: "student"
  });

  // Новый ученик начинает с нуля: очков нет, закрытых тем нет.
  // Показать здесь что-то другое было бы неправдой.
  saveProgress({ points: 0, closed: [] });

  window.location.href = "diagnostic.html";
}

// Дата -> строка "YYYY-MM-DD", в том же виде, в каком её отдаёт поле
// type="date". Месяц и день дополняем нулём слева: "2027-04-05", а не "2027-4-5".
function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

// --- Демо-вход ---

// Готовые аккаунты для жюри. passHash пустой намеренно: у демо-профиля
// нет пароля, хешировать нечего.
function enterAsStudent() {
  // Демо-аккаунту дату считаем от сегодняшнего дня, а не зашиваем: иначе
  // через полгода в демо будет дата в прошлом.
  const demoDeadline = new Date();
  demoDeadline.setMonth(demoDeadline.getMonth() + 8);

  saveProfile({
    name: "Айгерим",
    passHash: "",
    grade: 8,
    subject: "Математика",
    level: "medium",
    goal: "gaps",
    deadline: toDateString(demoDeadline),
    role: "student"
  });
  // Стартовый прогресс демо-ученика: столько же очков, сколько показывал
  // mock.js, пока очки не стали считаться по-настоящему. Жюри не должно
  // попадать в пустой кабинет. Закрытых тем нет: их ученик закрывает сам.
  saveProgress({ points: 340, closed: [] });
  // Ученик начинает с диагностики: жюри проходит весь путь и видит
  // спуск к корневому пробелу — главную идею продукта.
  window.location.href = "diagnostic.html";
}

function enterAsTeacher() {
  saveProfile({
    name: "Гүлнара Серікқызы",
    passHash: "",
    grade: 0,
    subject: "Математика",
    level: "",
    goal: "",
    deadline: "",
    role: "teacher"
  });
  // У учителя ученического прогресса нет — пишем ноль, чтобы в localStorage
  // не остался прогресс предыдущего аккаунта.
  saveProgress({ points: 0, closed: [] });
  window.location.href = "teacher.html";
}

// --- Обработчики ---

form.addEventListener("submit", submitForm);
document.getElementById("demo-student").addEventListener("click", enterAsStudent);
document.getElementById("demo-teacher").addEventListener("click", enterAsTeacher);
