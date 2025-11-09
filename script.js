const BASE_URL = "https://smartday-personal-productivity-tracker.onrender.com";

// main elements
const dropdown = document.getElementById("menuDropdown");
const addBtn = document.getElementById("addMenuBtn");
const contentArea = document.getElementById("contentArea");

// counters
let taskCount = 0;
let routineCount = 0;

// show selected container
function showSelectedContainer() {
  const selectedValue = dropdown.value;
  document.querySelectorAll("#contentArea > div").forEach(div => div.style.display = "none");
  const selectedContainer = document.getElementById(selectedValue);
  if (selectedContainer) selectedContainer.style.display = "block";
}

// helper: determine category type from an existing container id
function getCategoryTypeFromContainer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return "task";
  return container.classList.contains("taskContainer") ? "task" : "routine";
}

function getCSRFToken() {
  const match = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
  return match ? match.split('=')[1] : '';
}

// append item and wire backend
function appendItemToList(listEl, item) {
  const li = document.createElement("li");
  if (item.id) li.dataset.itemId = item.id;
  if (item.status === "completed") li.classList.add("completed-task");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.status === "completed";

  checkbox.addEventListener("change", async () => {
    const isChecked = checkbox.checked;
    li.classList.toggle("completed-task", isChecked);
    updateCounts(listEl);

    if (!item.id) return;

    try {
      const res = await fetch(`${BASE_URL}/toggle_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id })
      });
      if (!res.ok) throw new Error(`toggle_item failed: ${res.status}`);
      const data = await res.json();
      const newStatus = data.new_status;
      checkbox.checked = newStatus === "completed";
      li.classList.toggle("completed-task", newStatus === "completed");
      updateCounts(listEl);
    } catch (err) {
      console.error("toggle_item error:", err);
      checkbox.checked = !isChecked;
      li.classList.toggle("completed-task", !isChecked);
      updateCounts(listEl);
      alert("Failed to change item status on server.");
    }
  });

  const titleSpan = document.createElement("span");
  titleSpan.textContent = item.title || "";

  if (item.time) {
    const timeSpan = document.createElement("span");
    timeSpan.classList.add("routine-time");
    timeSpan.textContent = item.time;
    li.append(checkbox, timeSpan, titleSpan);
  } else {
    li.append(checkbox, titleSpan);
  }

  const delBtn = document.createElement("button");
  delBtn.innerHTML = "🗑️";
  delBtn.addEventListener("click", async () => {
    const nextSibling = li.nextSibling;
    li.remove();
    updateCounts(listEl);
    if (!item.id) return;
    try {
      const res = await fetch(`${BASE_URL}/delete_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id })
      });
      if (!res.ok) throw new Error(`delete_item failed: ${res.status}`);
      const data = await res.json();
      if (data.status !== "ok") throw new Error(data.message || "delete failed");
    } catch (err) {
      console.error("delete_item error:", err);
      if (nextSibling) listEl.insertBefore(li, nextSibling);
      else listEl.appendChild(li);
      updateCounts(listEl);
      alert("Failed to delete item on server.");
    }
  });

  li.appendChild(delBtn);
  listEl.appendChild(li);
  updateCounts(listEl);
}

function updateCounts(listEl) {
  const container = listEl.closest("div");
  if (!container) return;
  const all = listEl.querySelectorAll("li").length;
  const completed = listEl.querySelectorAll("li.completed-task").length;
  const active = all - completed;
  container.querySelector(".count-all").textContent = all;
  container.querySelector(".count-active").textContent = active;
  container.querySelector(".count-completed").textContent = completed;
}

// create task container
function createTaskContainer(id, title, categoryId, items = []) {
  if (document.getElementById(id)) return;
  const container = document.createElement("div");
  container.id = id;
  container.classList.add("taskContainer");
  container.dataset.categoryId = categoryId;
  container.innerHTML = `
    <h2>${title}</h2>
    <div class="task-input">
      <input type="text" class="taskInput" placeholder="Enter your task..." />
      <button class="addTaskBtn">+</button>
    </div>
    <div class="filter-container">
      <button class="filter-btn active" data-filter="all">All (<span class="count-all">0</span>)</button>
      <button class="filter-btn" data-filter="active">Active (<span class="count-active">0</span>)</button>
      <button class="filter-btn" data-filter="completed">Completed (<span class="count-completed">0</span>)</button>
    </div>
    <ul class="taskList"></ul>
  `;
  contentArea.appendChild(container);

  const inputEl = container.querySelector(".taskInput");
  const listEl = container.querySelector(".taskList");
  const addLocal = container.querySelector(".addTaskBtn");

  addLocal.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    const catId = container.dataset.categoryId;
    try {
      const res = await fetch(`${BASE_URL}/add_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: catId, title: text })
      });
      if (!res.ok) throw new Error("add_item failed");
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status });
    } catch {
      appendItemToList(listEl, { title: text, status: "active" });
    }
    inputEl.value = "";
  });

  inputEl.addEventListener("keypress", e => { if (e.key === "Enter") addLocal.click(); });
  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// create routine container (same idea)
function createRoutineContainer(id, title, categoryId, items = []) {
  if (document.getElementById(id)) return;
  const container = document.createElement("div");
  container.id = id;
  container.classList.add("routineContainer");
  container.dataset.categoryId = categoryId;
  container.innerHTML = `
    <h2>${title}</h2>
    <div class="task-input">
      <input type="time" class="routineTime" value="07:00" />
      <input type="text" class="routineInput" placeholder="What's your routine?" />
      <button class="addRoutineBtn">+</button>
    </div>
    <div class="filter-container">
      <button class="filter-btn active" data-filter="all">All (<span class="count-all">0</span>)</button>
      <button class="filter-btn" data-filter="active">Active (<span class="count-active">0</span>)</button>
      <button class="filter-btn" data-filter="completed">Completed (<span class="count-completed">0</span>)</button>
    </div>
    <ul class="routineList"></ul>
  `;
  contentArea.appendChild(container);

  const inputEl = container.querySelector(".routineInput");
  const timeEl = container.querySelector(".routineTime");
  const listEl = container.querySelector(".routineList");
  const addLocal = container.querySelector(".addRoutineBtn");

  addLocal.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    const time = timeEl.value;
    if (!text) return;
    const catId = container.dataset.categoryId;
    try {
      const res = await fetch(`${BASE_URL}/add_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: catId, title: text, time })
      });
      if (!res.ok) throw new Error("add_item failed");
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status, time: data.time });
    } catch {
      appendItemToList(listEl, { title: text, status: "active", time });
    }
    inputEl.value = "";
  });

  inputEl.addEventListener("keypress", e => { if (e.key === "Enter") addLocal.click(); });
  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// category creation
async function createCategoryOnServer(name, type) {
  const res = await fetch(`${BASE_URL}/add_category/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type })
  });
  if (!res.ok) throw new Error("add_category failed");
  return await res.json();
}

// initial load
async function loadCategories() {
  try {
    const res = await fetch(`${BASE_URL}/get_categories/`);
    const data = await res.json();
    dropdown.innerHTML = "";
    contentArea.innerHTML = "";

    (data.categories || []).forEach(cat => {
      const option = document.createElement("option");
      option.value = `cat${cat.id}`;
      option.textContent = cat.name;
      dropdown.appendChild(option);
      if (cat.type === "task")
        createTaskContainer(option.value, cat.name, cat.id, cat.items || []);
      else
        createRoutineContainer(option.value, cat.name, cat.id, cat.items || []);
    });

    if (dropdown.options.length) {
      dropdown.value = dropdown.options[0].value;
      showSelectedContainer();
    }
  } catch (err) {
    console.error("loadCategories failed:", err);
  }
}

// add button handler
addBtn.addEventListener("click", async () => {
  const selectedType = dropdown.value ? getCategoryTypeFromContainer(dropdown.value) : "task";
  let name;
  if (selectedType === "task") {
    taskCount++;
    name = `Task ${taskCount}`;
  } else {
    routineCount++;
    name = `Routine ${routineCount}`;
  }

  try {
    const data = await createCategoryOnServer(name, selectedType);
    const value = `cat${data.id}`;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    dropdown.appendChild(option);
    if (selectedType === "task") createTaskContainer(value, name, data.id);
    else createRoutineContainer(value, name, data.id);
    dropdown.value = value;
    showSelectedContainer();
  } catch (err) {
    console.error("Failed to create new menu:", err);
  }
});

dropdown.addEventListener("change", showSelectedContainer);
document.addEventListener("DOMContentLoaded", loadCategories);
