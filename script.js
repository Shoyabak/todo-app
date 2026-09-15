const storageKey = "professional_todo_app_tasks";
const sessionUserKey = "professional_todo_app_user";
const userStoreKey = "professional_todo_app_user_store";

const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const loginUsername = document.querySelector("#login-username");
const loginPassword = document.querySelector("#login-password");
const loginMessage = document.querySelector("#login-message");
const appPanel = document.querySelector("#todo-app");
const userGreeting = document.querySelector("#user-name");
const logoutButton = document.querySelector("#logout-button");
const todoForm = document.querySelector("#todo-form");
const todoInput = document.querySelector("#todo-input");
const categorySelect = document.querySelector("#category-select");
const dueDateInput = document.querySelector("#due-date");
const reminderCheckbox = document.querySelector("#reminder");
const todoList = document.querySelector("#todo-list");
const statusSummary = document.querySelector(".status-summary");
const filterButtons = document.querySelectorAll(".filter-btn");
const categoryFilterButtons = document.querySelectorAll(".category-filter-btn");
const clearCompletedButton = document.querySelector("#clear-completed");
const exportButton = document.querySelector("#export-tasks");
const themeToggle = document.querySelector(".theme-toggle");
const searchInput = document.querySelector("#search-input");
const statTotal = document.querySelector("#stat-total");
const statCompleted = document.querySelector("#stat-completed");
const statPending = document.querySelector("#stat-pending");
const statPercentage = document.querySelector("#stat-percentage");

let tasks = [];
let activeFilter = "all";
let activeCategory = "";
let searchQuery = "";
let currentUser = null;

function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTaskStorageKey() {
  return `${storageKey}_${encodeURIComponent(currentUser)}`;
}

function getUserStore() {
  try {
    const stored = localStorage.getItem(userStoreKey);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {};
  }
}

function saveUserStore(store) {
  localStorage.setItem(userStoreKey, JSON.stringify(store));
}

function hashPassword(password) {
  return btoa(password.split("").reverse().join(""));
}

function getLoggedUser() {
  return localStorage.getItem(sessionUserKey);
}

function setLoggedUser(username) {
  currentUser = username;
  localStorage.setItem(sessionUserKey, username);
}

function clearLoggedUser() {
  currentUser = null;
  localStorage.removeItem(sessionUserKey);
}

function setVisibleSection(section) {
  if (section === "app") {
    loginPanel.classList.add("hidden");
    appPanel.classList.remove("hidden");
  } else {
    loginPanel.classList.remove("hidden");
    appPanel.classList.add("hidden");
  }
}

function showLogin(message = "") {
  setVisibleSection("login");
  loginMessage.textContent = message;
}

function showApp() {
  setVisibleSection("app");
  userGreeting.textContent = currentUser;
}

function saveTasks() {
  if (!currentUser) return;
  localStorage.setItem(getTaskStorageKey(), JSON.stringify(tasks));
}

function loadTasks() {
  if (!currentUser) {
    tasks = [];
    return;
  }

  try {
    const stored = localStorage.getItem(getTaskStorageKey());
    tasks = stored ? JSON.parse(stored) : [];
    // Ensure all tasks have a category (for backwards compatibility)
    tasks = tasks.map(task => ({
      ...task,
      category: task.category || "personal"
    }));
  } catch (error) {
    tasks = [];
  }
}

function updateSummary() {
  const total = tasks.length;
  const completedCount = tasks.filter(task => task.completed).length;
  const activeCount = total - completedCount;
  statusSummary.textContent = `${activeCount} active · ${completedCount} completed · ${total} total`;
}

function updateStats() {
  const total = tasks.length;
  const completedCount = tasks.filter(task => task.completed).length;
  const pendingCount = total - completedCount;
  const completionPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  
  statTotal.textContent = total;
  statCompleted.textContent = completedCount;
  statPending.textContent = pendingCount;
  statPercentage.textContent = completionPercentage + "%";
}

function getFilteredTasks() {
  let filtered = tasks;
  
  if (activeFilter === "active") {
    filtered = filtered.filter(task => !task.completed);
  } else if (activeFilter === "completed") {
    filtered = filtered.filter(task => task.completed);
  }
  
  if (activeCategory) {
    filtered = filtered.filter(task => task.category === activeCategory);
  }
  
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(task => task.text.toLowerCase().includes(query));
  }
  
  return filtered;
}

function renderTasks() {
  const visibleTasks = getFilteredTasks();
  console.log("Rendering tasks - Filter:", activeFilter, "Category:", activeCategory, "Search:", searchQuery, "Visible tasks:", visibleTasks.length);
  const now = new Date();
  todoList.innerHTML = visibleTasks.map(task => {
    const category = task.category || "personal";
    const isOverdue = task.dueDate && new Date(task.dueDate) < now && !task.completed;
    const dueDateDisplay = task.dueDate ? `<small class="due-date">${new Date(task.dueDate).toLocaleDateString()}</small>` : '';
    return `
      <li class="todo-item ${task.completed ? "completed" : ""} ${isOverdue ? "overdue" : ""}" data-id="${task.id}">
        <label class="checkbox-label">
          <input type="checkbox" ${task.completed ? "checked" : ""} aria-label="Mark task as completed" />
          <div>
            <p class="task-text">${escapeHtml(task.text)}</p>
            ${dueDateDisplay}
          </div>
        </label>
        <span class="category-badge ${category}">${category}</span>
        <button class="delete-btn" type="button" aria-label="Delete task">✕</button>
      </li>
    `;
  }).join("");

  updateSummary();
  updateStats();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function addTask(text, dueDate = null, reminder = false, category = "personal") {
  const task = { id: createTaskId(), text: text.trim(), completed: false, createdAt: Date.now(), dueDate, reminder, category };
  tasks.unshift(task);
  saveTasks();
  renderTasks();
  if (reminder && dueDate) {
    scheduleReminder(task);
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function rescheduleReminders() {
  tasks.forEach(task => {
    if (task.reminder && task.dueDate && !task.completed) {
      scheduleReminder(task);
    }
  });
}

function toggleTaskCompletion(taskId) {
  tasks = tasks.map(task => task.id === taskId ? { ...task, completed: !task.completed } : task);
  saveTasks();
  renderTasks();
}

function removeTask(taskId) {
  tasks = tasks.filter(task => task.id !== taskId);
  saveTasks();
  renderTasks();
}

function clearCompletedTasks() {
  tasks = tasks.filter(task => !task.completed);
  saveTasks();
  renderTasks();
}

function updateFilter(newFilter) {
  activeFilter = newFilter;
  filterButtons.forEach(button => button.classList.toggle("active", button.dataset.filter === newFilter));
  renderTasks();
}

function exportTasks() {
  const payload = JSON.stringify(tasks, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "todo-tasks.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function restoreTheme() {
  const theme = localStorage.getItem("professional_todo_theme") || "dark";
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = current;
  localStorage.setItem("professional_todo_theme", current);
  themeToggle.textContent = current === "dark" ? "☀️" : "🌙";
}

function handleLoginSubmit(event) {
  event.preventDefault();

  const username = loginUsername.value.trim();
  const password = loginPassword.value;

  if (!username) {
    loginMessage.textContent = "Please enter a username.";
    return;
  }

  if (password.length < 4) {
    loginMessage.textContent = "Password must be at least 4 characters.";
    return;
  }

  const users = getUserStore();
  const hashedPassword = hashPassword(password);

  if (users[username]) {
    if (users[username] !== hashedPassword) {
      loginMessage.textContent = "Incorrect password. Please try again.";
      return;
    }
  } else {
    users[username] = hashedPassword;
    saveUserStore(users);
    loginMessage.textContent = "Account created locally. Signing you in...";
  }

  setLoggedUser(username);
  loginForm.reset();
  loginMessage.textContent = "";
  loadTasks();
  updateFilter("all");
  activeCategory = "";
  categoryFilterButtons[0].classList.add("active");
  categoryFilterButtons.forEach((btn, i) => {
    if (i > 0) btn.classList.remove("active");
  });
  renderTasks();
  showApp();
  todoInput.focus();
}

function logout() {
  clearLoggedUser();
  tasks = [];
  activeFilter = "all";
  activeCategory = "";
  searchQuery = "";
  searchInput.value = "";
  showLogin();
}

todoForm.addEventListener("submit", event => {
  event.preventDefault();
  const taskText = todoInput.value;
  const dueDate = dueDateInput.value;
  const reminder = reminderCheckbox.checked;
  const category = categorySelect.value;
  if (!taskText.trim()) {
    return;
  }
  addTask(taskText, dueDate || null, reminder, category);
  todoForm.reset();
  todoInput.focus();
});

loginForm.addEventListener("submit", handleLoginSubmit);
logoutButton.addEventListener("click", logout);

todoList.addEventListener("click", event => {
  const item = event.target.closest(".todo-item");
  if (!item) return;

  const taskId = item.dataset.id;
  if (event.target.matches("input[type='checkbox']")) {
    toggleTaskCompletion(taskId);
    return;
  }

  if (event.target.matches(".delete-btn")) {
    removeTask(taskId);
  }
});

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    updateFilter(button.dataset.filter);
  });
});

categoryFilterButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    console.log("Category selected:", activeCategory, "Total tasks:", tasks.length);
    categoryFilterButtons.forEach(btn => {
      const shouldBeActive = btn.dataset.category === activeCategory;
      btn.classList.toggle("active", shouldBeActive);
      console.log("Button", btn.textContent, "active:", shouldBeActive);
    });
    renderTasks();
  });
});

clearCompletedButton.addEventListener("click", clearCompletedTasks);
exportButton.addEventListener("click", exportTasks);
themeToggle.addEventListener("click", toggleTheme);

searchInput.addEventListener("input", event => {
  searchQuery = event.target.value;
  console.log("Search query:", searchQuery);
  renderTasks();
});

window.addEventListener("DOMContentLoaded", () => {
  restoreTheme();
  requestNotificationPermission();
  const loggedUser = getLoggedUser();
  if (loggedUser) {
    setLoggedUser(loggedUser);
    loadTasks();
    rescheduleReminders();
    updateFilter("all");
    renderTasks();
    showApp();
  } else {
    showLogin();
  }
});
