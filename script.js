// Base API URL (backend)
const API_BASE = "https://smartday-personal-productivity-tracker.onrender.com/api";

// main DOM nodes
const dropdown = document.getElementById("menuDropdown");
const addMenuBtn = document.getElementById("addMenuBtn");
const contentArea = document.getElementById("contentArea");

// counters for naming (used only if you need numbered defaults)
let taskCount = 0;
let routineCount = 0;

/* ======= Utility & UI helpers ======= */

// remove "no menus" placeholder if present
function removeNoMenusPlaceholder() {
  const ph = document.getElementById("no-menus-placeholder");
  if (ph) ph.remove();
}

// show only the selected container
function showSelectedContainer() {
  const val = dropdown.value;
  document.querySelectorAll("#contentArea > div").forEach(d => d.style.display = "none");
  const el = document.getElementById(val);
  if (el) el.style.display = "block";
}

// update counts inside a container (all/active/completed)
function updateCounts(listEl) {
  const container = listEl.closest("div");
  if (!container) return;
  const all = listEl.querySelectorAll("li").length;
  const completed = listEl.querySelectorAll("li.completed-task").length;
  const active = all - completed;
  const cAll = container.querySelector(".count-all");
  const cActive = container.querySelector(".count-active");
  const cComp = container.querySelector(".count-completed");
  if (cAll) cAll.textContent = all;
  if (cActive) cActive.textContent = active;
  if (cComp) cComp.textContent = completed;
}

/* ======= Item DOM wiring (checkbox + delete) ======= */

function appendItemToList(listEl, item) {
  const li = document.createElement("li");
  if (item.status === "completed") li.classList.add("completed-task");

  // checkbox
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.status === "completed";

  // toggle status (optimistic UI)
  checkbox.addEventListener("change", async () => {
    const checkedNow = checkbox.checked;
    li.classList.toggle("completed-task", checkedNow);
    updateCounts(listEl);
    if (!item.id) return; // local-only fallback item
    try {
      const res = await fetch(`${API_BASE}/toggle_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id })
      });
      if (!res.ok) throw new Error("toggle_item failed");
      const data = await res.json();
      // sync with server response
      const newStatus = data.new_status;
      const shouldBeChecked = newStatus === "completed";
      checkbox.checked = shouldBeChecked;
      li.classList.toggle("completed-task", shouldBeChecked);
      updateCounts(listEl);
    } catch (e) {
      console.error("toggle_item error:", e);
      // rollback UI
      checkbox.checked = !checkedNow;
      li.classList.toggle("completed-task", !checkedNow);
      updateCounts(listEl);
    }
  });

  // title text
  const titleSpan = document.createElement("span");
  titleSpan.textContent = item.title || "";

  // optional time for routines
  if (item.time) {
    const timeSpan = document.createElement("span");
    timeSpan.className = "routine-time";
    timeSpan.textContent = item.time;
    li.append(checkbox, timeSpan, titleSpan);
  } else {
    li.append(checkbox, titleSpan);
  }

  // delete item button (silent)
  const delBtn = document.createElement("button");
  delBtn.innerHTML = "🗑️";
  delBtn.className = "delete-btn";
  delBtn.addEventListener("click", async () => {
    const next = li.nextSibling;
    li.remove();
    updateCounts(listEl);
    if (!item.id) return;
    try {
      const res = await fetch(`${API_BASE}/delete_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id })
      });
      if (!res.ok) throw new Error("delete_item failed");
      const data = await res.json();
      if (data.status !== "ok") throw new Error("delete_item returned error");
    } catch (e) {
      console.error("delete_item failed:", e);
      // rollback on failure
      if (next) listEl.insertBefore(li, next);
      else listEl.appendChild(li);
      updateCounts(listEl);
    }
  });

  li.appendChild(delBtn);
  listEl.appendChild(li);
  updateCounts(listEl);
}

/* ======= Category container creation ======= */

// create task container (removes placeholder if present)
function createTaskContainer(containerId, title, categoryId, items = []) {
  if (document.getElementById(containerId)) return;
  removeNoMenusPlaceholder();

  const container = document.createElement("div");
  container.id = containerId;
  container.className = "taskContainer";
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
  const filters = container.querySelectorAll(".filter-btn");

  // create item on server
  addBtn.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    try {
      const res = await fetch(`${API_BASE}/add_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, title: text })
      });
      if (!res.ok) throw new Error("add_item failed");
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status });
    } catch (e) {
      console.error("add_item error, fallback to local:", e);
      appendItemToList(listEl, { title: text, status: "active" });
    }
    inputEl.value = "";
  });

  inputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") addBtn.click(); });

  // filters
  filters.forEach(b => {
    b.addEventListener("click", () => {
      filters.forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const f = b.dataset.filter;
      listEl.querySelectorAll("li").forEach(li => {
        const isCompleted = li.classList.contains("completed-task");
        li.style.display = (f === "all" || (f === "completed" && isCompleted) || (f === "active" && !isCompleted)) ? "" : "none";
      });
    });
  });

  // populate items
  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// create routine container (removes placeholder if present)
function createRoutineContainer(containerId, title, categoryId, items = []) {
  if (document.getElementById(containerId)) return;
  removeNoMenusPlaceholder();

  const container = document.createElement("div");
  container.id = containerId;
  container.className = "routineContainer";
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
  const filters = container.querySelectorAll(".filter-btn");

  addBtn.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    const time = timeEl.value;
    if (!text) return;
    try {
      const res = await fetch(`${API_BASE}/add_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, title: text, time })
      });
      if (!res.ok) throw new Error("add_item failed");
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status, time: data.time });
    } catch (e) {
      console.error("add_routine error, fallback to local:", e);
      appendItemToList(listEl, { title: text, status: "active", time });
    }
    inputEl.value = "";
  });

  inputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") addBtn.click(); });

  filters.forEach(b => {
    b.addEventListener("click", () => {
      filters.forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const f = b.dataset.filter;
      listEl.querySelectorAll("li").forEach(li => {
        const isCompleted = li.classList.contains("completed-task");
        li.style.display = (f === "all" || (f === "completed" && isCompleted) || (f === "active" && !isCompleted)) ? "" : "none";
      });
    });
  });

  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

/* ======= Server interactions for categories ======= */

async function createCategoryOnServer(name, type) {
  const res = await fetch(`${API_BASE}/add_category/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type })
  });
  if (!res.ok) throw new Error("add_category failed");
  return await res.json();
}

async function deleteCategoryOnServer(categoryId) {
  try {
    const res = await fetch(`${API_BASE}/delete_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId })
    });
    if (!res.ok) throw new Error("delete_category failed");
    const data = await res.json();
    return data;
  } catch (e) {
    console.error("delete_category error:", e);
    return null;
  }
}

/* ======= Inline add-menu UI (no alert/prompt) ======= */

function showInlineAddMenu() {
  if (document.getElementById("inline-add-menu")) return;
  const wrapper = document.createElement("div");
  wrapper.id = "inline-add-menu";
  wrapper.style.display = "flex";
  wrapper.style.gap = "8px";
  wrapper.style.marginTop = "8px";
  wrapper.style.alignItems = "center";

  const nameInput = document.createElement("input");
  nameInput.placeholder = "Menu name";
  nameInput.style.padding = "6px";

  const typeSelect = document.createElement("select");
  const o1 = document.createElement("option"); o1.value = "task"; o1.text = "task";
  const o2 = document.createElement("option"); o2.value = "routine"; o2.text = "routine";
  typeSelect.append(o1, o2);

  const createBtn = document.createElement("button");
  createBtn.textContent = "Create";
  createBtn.style.background = "#8411FF";
  createBtn.style.color = "white";
  createBtn.style.border = "none";
  createBtn.style.padding = "6px 10px";
  createBtn.style.borderRadius = "6px";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.padding = "6px 10px";

  wrapper.append(nameInput, typeSelect, createBtn, cancelBtn);
  addMenuBtn.parentNode.insertBefore(wrapper, addMenuBtn.nextSibling);

  cancelBtn.addEventListener("click", () => wrapper.remove());

  createBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const type = typeSelect.value;
    if (!name) return;
    try {
      const created = await createCategoryOnServer(name, type);
      // add option and container
      const key = `cat${created.id}`;
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = created.name;
      dropdown.appendChild(opt);
      if (type === "task") createTaskContainer(key, created.name, created.id, created.items || []);
      else createRoutineContainer(key, created.name, created.id, created.items || []);
      dropdown.value = key;
      showSelectedContainer();
    } catch (e) {
      console.error("create category failed:", e);
    } finally {
      wrapper.remove();
    }
  });
}

/* ======= Delete current menu button behavior (silent) ======= */

async function handleDeleteCurrentMenu() {
  const val = dropdown.value;
  if (!val) return;
  const id = val.replace(/^cat/, "");
  // remove from UI
  const opt = dropdown.querySelector(`option[value="${val}"]`);
  if (opt) opt.remove();
  const container = document.getElementById(val);
  if (container) container.remove();
  // pick next option or show placeholder
  if (dropdown.options.length) {
    dropdown.value = dropdown.options[0].value;
    showSelectedContainer();
  } else {
    contentArea.innerHTML = `<p id="no-menus-placeholder" style="color:#666;text-align:center;margin-top:16px">No menus yet — click Add Menu to create one.</p>`;
  }
  // call server silently
  await deleteCategoryOnServer(id);
}

/* ======= Add the Delete Menu button next to Add Menu ======= */
(function addDeleteMenuButton() {
  if (document.getElementById("deleteMenuBtn")) return;
  const btn = document.createElement("button");
  btn.id = "deleteMenuBtn";
  btn.textContent = "Delete Menu";
  btn.style.marginLeft = "8px";
  btn.style.background = "#e74c3c";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.padding = "6px 10px";
  btn.style.borderRadius = "6px";
  addMenuBtn.parentNode.insertBefore(btn, addMenuBtn.nextSibling);
  btn.addEventListener("click", handleDeleteCurrentMenu);
})();

/* ======= Load categories on start ======= */

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/get_categories/`);
    if (!res.ok) throw new Error("GET categories failed");
    const data = await res.json();
    dropdown.innerHTML = "";
    contentArea.innerHTML = "";

    let lastKey = null;
    (data.categories || []).forEach(cat => {
      const key = `cat${cat.id}`;
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = cat.name;
      dropdown.appendChild(opt);
      if (cat.type === "task") createTaskContainer(key, cat.name, cat.id, cat.items || []);
      else createRoutineContainer(key, cat.name, cat.id, cat.items || []);
      lastKey = key;
    });

    if (dropdown.options.length) {
      dropdown.value = lastKey;
      showSelectedContainer();
    } else {
      contentArea.innerHTML = `<p id="no-menus-placeholder" style="color:#666;text-align:center;margin-top:16px">No menus yet — click Add Menu to create one.</p>`;
    }
  } catch (e) {
    console.error("loadCategories failed:", e);
    contentArea.innerHTML = `<p id="no-menus-placeholder" style="color:#666;text-align:center;margin-top:16px">Failed to load menus.</p>`;
  }
}

/* ======= Wire top-level UI events and start ======= */

dropdown.addEventListener("change", showSelectedContainer);
addMenuBtn.addEventListener("click", showInlineAddMenu);

// initial load
document.addEventListener("DOMContentLoaded", loadCategories);
