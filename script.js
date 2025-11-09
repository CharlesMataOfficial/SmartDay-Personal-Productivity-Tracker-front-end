// 🌐 Base URL of your backend API (Render)
const BASE_URL = "https://smartday-personal-productivity-tracker.onrender.com/api";

// grab important elements
const contentArea = document.getElementById("contentArea");
const addMenuBtn = document.getElementById("addMenuBtn");
const menuDropdown = document.getElementById("menuDropdown");

// keep track of categories
let categories = [];

// load all categories from server
async function loadCategories() {
  try {
    const res = await fetch(`${BASE_URL}/get_categories/`);
    if (!res.ok) throw new Error("get_categories failed");
    const data = await res.json();
    categories = data;

    menuDropdown.innerHTML = "";
    data.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      menuDropdown.appendChild(opt);
    });

    // show first category automatically
    if (data.length > 0) {
      showCategory(data[0].id, data[0].type, data[0].name);
    }
  } catch (err) {
    console.error("loadCategories failed:", err);
  }
}

// show a category container depending on type
async function showCategory(categoryId, type, name) {
  const containerId = `container-${categoryId}`;
  const oldContainer = document.getElementById(containerId);
  if (oldContainer) oldContainer.remove();

  try {
    const res = await fetch(`${BASE_URL}/get_items/${categoryId}/`);
    const items = res.ok ? await res.json() : [];

    if (type === "task") {
      createTaskContainer(containerId, name, categoryId, items);
    } else {
      createRoutineContainer(containerId, name, categoryId, items);
    }
  } catch (err) {
    console.error("showCategory failed:", err);
  }
}

// helper: adds a new item to the list
function appendItemToList(listEl, item) {
  const li = document.createElement("li");
  li.textContent = item.title;
  if (item.status === "completed") li.classList.add("completed-task");

  // click to toggle completed
  li.addEventListener("click", async () => {
    li.classList.toggle("completed-task");
    const newStatus = li.classList.contains("completed-task") ? "completed" : "active";
    try {
      await fetch(`${BASE_URL}/update_item/${item.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.warn("update_item failed (offline mode)");
    }
    updateCounts(listEl);
  });

  listEl.appendChild(li);
  updateCounts(listEl);
}

// helper: update task/routine counts
function updateCounts(listEl) {
  const container = listEl.closest(".taskContainer, .routineContainer");
  const allCount = container.querySelector(".count-all");
  const activeCount = container.querySelector(".count-active");
  const completedCount = container.querySelector(".count-completed");

  const allItems = listEl.querySelectorAll("li").length;
  const completedItems = listEl.querySelectorAll("li.completed-task").length;
  const activeItems = allItems - completedItems;

  allCount.textContent = allItems;
  activeCount.textContent = activeItems;
  completedCount.textContent = completedItems;
}

// ✳️ create task container (with filter logic)
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
  const addBtn = container.querySelector(".addTaskBtn");
  const filterBtns = container.querySelectorAll(".filter-btn");
  let currentFilter = "all";

  // filter buttons logic
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;

      listEl.querySelectorAll("li").forEach(li => {
        const done = li.classList.contains("completed-task");
        if (currentFilter === "all") li.style.display = "";
        else if (currentFilter === "active") li.style.display = done ? "none" : "";
        else if (currentFilter === "completed") li.style.display = done ? "" : "none";
      });
    });
  });

  // add new task
  addBtn.addEventListener("click", async () => {
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
    filterBtns.forEach(b => { if (b.dataset.filter === currentFilter) b.click(); });
  });

  // press Enter to add
  inputEl.addEventListener("keypress", e => { if (e.key === "Enter") addBtn.click(); });

  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// ✳️ create routine container (similar to task)
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
  const addBtn = container.querySelector(".addRoutineBtn");
  const filterBtns = container.querySelectorAll(".filter-btn");
  let currentFilter = "all";

  // filter buttons logic
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;

      listEl.querySelectorAll("li").forEach(li => {
        const done = li.classList.contains("completed-task");
        if (currentFilter === "all") li.style.display = "";
        else if (currentFilter === "active") li.style.display = done ? "none" : "";
        else if (currentFilter === "completed") li.style.display = done ? "" : "none";
      });
    });
  });

  // add new routine
  addBtn.addEventListener("click", async () => {
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
    filterBtns.forEach(b => { if (b.dataset.filter === currentFilter) b.click(); });
  });

  // press Enter to add
  inputEl.addEventListener("keypress", e => { if (e.key === "Enter") addBtn.click(); });

  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// 🔘 add new category (menu)
addMenuBtn.addEventListener("click", async () => {
  const name = prompt("Enter category name:");
  const type = prompt("Enter type: task or routine").toLowerCase();
  if (!name || (type !== "task" && type !== "routine")) return;

  try {
    const res = await fetch(`${BASE_URL}/add_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type })
    });
    if (!res.ok) throw new Error("add_category failed");
    const data = await res.json();
    categories.push(data);

    const opt = document.createElement("option");
    opt.value = data.id;
    opt.textContent = data.name;
    menuDropdown.appendChild(opt);
    menuDropdown.value = data.id;
    showCategory(data.id, data.type, data.name);
  } catch (err) {
    console.error("Failed to create new menu:", err);
  }
});

// 🔁 when selecting category from dropdown
menuDropdown.addEventListener("change", e => {
  const selected = categories.find(c => c.id == e.target.value);
  if (selected) showCategory(selected.id, selected.type, selected.name);
});

// 🚀 initial load
loadCategories();
