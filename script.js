// base API url (backend)
const API_BASE = "https://smartday-personal-productivity-tracker.onrender.com/api";

// main DOM nodes
const dropdown = document.getElementById("menuDropdown");
const addMenuBtn = document.getElementById("addMenuBtn");
const contentArea = document.getElementById("contentArea");

// counters (keeps track for naming)
let taskCount = 0;
let routineCount = 0;

// show only the selected container
function showSelectedContainer() {
  const val = dropdown.value;
  document.querySelectorAll("#contentArea > div").forEach(d => d.style.display = "none");
  const el = document.getElementById(val);
  if (el) el.style.display = "block";
}

// update counts inside a container
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

// append an item into a list and wire buttons
function appendItemToList(listEl, item) {
  const li = document.createElement("li");
  if (item.status === "completed") li.classList.add("completed-task");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.status === "completed";

  // toggle item status
  checkbox.addEventListener("change", async () => {
    const was = checkbox.checked;
    li.classList.toggle("completed-task", was);
    updateCounts(listEl);
    if (!item.id) return;
    try {
      await fetch(`${API_BASE}/toggle_item/`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ item_id: item.id })
      });
    } catch (e) {
      console.error("toggle_item failed", e);
      // rollback UI if needed
      checkbox.checked = !was;
      li.classList.toggle("completed-task", !was);
      updateCounts(listEl);
    }
  });

  const titleSpan = document.createElement("span");
  titleSpan.textContent = item.title || "";

  if (item.time) {
    const timeSpan = document.createElement("span");
    timeSpan.className = "routine-time";
    timeSpan.textContent = item.time;
    li.append(checkbox, timeSpan, titleSpan);
  } else {
    li.append(checkbox, titleSpan);
  }

  const delBtn = document.createElement("button");
  delBtn.innerHTML = "🗑️";
  delBtn.className = "delete-btn";
  delBtn.addEventListener("click", async () => {
    const next = li.nextSibling;
    li.remove();
    updateCounts(listEl);
    if (!item.id) return;
    try {
      await fetch(`${API_BASE}/delete_item/`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ item_id: item.id })
      });
    } catch (e) {
      console.error("delete_item failed", e);
      // rollback insert
      if (next) listEl.insertBefore(li, next);
      else listEl.appendChild(li);
      updateCounts(listEl);
    }
  });

  li.appendChild(delBtn);
  listEl.appendChild(li);
  updateCounts(listEl);
}

// create DOM for a task category
function createTaskContainer(containerId, title, categoryId, items = []) {
  if (document.getElementById(containerId)) return;
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

  // add task to backend
  addBtn.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    try {
      const res = await fetch(`${API_BASE}/add_item/`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ category_id: categoryId, title: text })
      });
      if (!res.ok) throw new Error("add_item failed");
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status });
    } catch (e) {
      console.error("add_item error, falling back to local", e);
      appendItemToList(listEl, { title: text, status: "active" });
    }
    inputEl.value = "";
  });

  inputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") addBtn.click(); });

  // filters behavior
  filters.forEach(b => {
    b.addEventListener("click", () => {
      filters.forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const f = b.dataset.filter;
      listEl.querySelectorAll("li").forEach(li => {
        const isCompleted = li.classList.contains("completed-task");
        li.style.display = (f === "all" || (f==="completed" && isCompleted) || (f==="active" && !isCompleted)) ? "" : "none";
      });
    });
  });

  // populate items
  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// create DOM for a routine category
function createRoutineContainer(containerId, title, categoryId, items = []) {
  if (document.getElementById(containerId)) return;
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
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ category_id: categoryId, title: text, time })
      });
      if (!res.ok) throw new Error("add_item failed");
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status, time: data.time });
    } catch (e) {
      console.error("add_routine error, fallback to local", e);
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
        li.style.display = (f === "all" || (f==="completed" && isCompleted) || (f==="active" && !isCompleted)) ? "" : "none";
      });
    });
  });

  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// create a category on the server
async function createCategoryOnServer(name, type) {
  const res = await fetch(`${API_BASE}/add_category/`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name, type })
  });
  if (!res.ok) throw new Error("add_category failed");
  return await res.json();
}

// delete category on server and remove UI without alerts
async function deleteCategoryOnServer(categoryId) {
  try {
    await fetch(`${API_BASE}/delete_category/`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ category_id: categoryId })
    });
  } catch (e) {
    console.error("delete_category failed", e);
  }
}

// show inline add-menu form (no prompt/alert)
function showInlineAddMenu() {
  if (document.getElementById("inline-add-menu")) return; // already shown
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
  const o1 = document.createElement("option"); o1.value="task"; o1.text="task";
  const o2 = document.createElement("option"); o2.value="routine"; o2.text="routine";
  typeSelect.append(o1, o2);

  const addBtn = document.createElement("button");
  addBtn.textContent = "Create";
  addBtn.style.background = "#8411FF";
  addBtn.style.color = "white";
  addBtn.style.border = "none";
  addBtn.style.padding = "6px 10px";
  addBtn.style.borderRadius = "6px";

  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  cancel.style.padding = "6px 10px";

  wrapper.append(nameInput, typeSelect, addBtn, cancel);
  addMenuBtn.parentNode.insertBefore(wrapper, addMenuBtn.nextSibling);

  cancel.addEventListener("click", () => wrapper.remove());

  addBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const type = typeSelect.value;
    if (!name) return;
    try {
      const created = await createCategoryOnServer(name, type);
      // add to dropdown and make container
      const opt = document.createElement("option");
      const key = `cat${created.id}`;
      opt.value = key;
      opt.textContent = created.name;
      dropdown.appendChild(opt);
      if (type === "task") createTaskContainer(key, created.name, created.id, created.items || []);
      else createRoutineContainer(key, created.name, created.id, created.items || []);
      dropdown.value = key;
      showSelectedContainer();
    } catch (e) {
      console.error("create category failed", e);
    } finally {
      wrapper.remove();
    }
  });
}

// load categories from backend and build UI
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
      contentArea.innerHTML = `<p style="color:#666;text-align:center;margin-top:16px">No menus yet — click Add Menu to create one.</p>`;
    }
  } catch (e) {
    console.error("loadCategories failed", e);
    contentArea.innerHTML = `<p style="color:#666;text-align:center;margin-top:16px">Failed to load menus.</p>`;
  }
}

// delete current menu when user clicks delete (we add delete button to DOM below)
async function handleDeleteCurrentMenu() {
  const val = dropdown.value;
  if (!val) return;
  const id = val.replace(/^cat/, "");
  // remove from UI first
  const opt = dropdown.querySelector(`option[value="${val}"]`);
  if (opt) opt.remove();
  const container = document.getElementById(val);
  if (container) container.remove();
  // pick next available
  if (dropdown.options.length) {
    dropdown.value = dropdown.options[0].value;
    showSelectedContainer();
  } else {
    contentArea.innerHTML = `<p style="color:#666;text-align:center;margin-top:16px">No menus yet — click Add Menu to create one.</p>`;
  }
  // call server delete (silent)
  await deleteCategoryOnServer(id);
}

// add UI delete menu button (beside Add Menu)
(function addDeleteMenuButton() {
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

// wire events
dropdown.addEventListener("change", showSelectedContainer);
addMenuBtn.addEventListener("click", showInlineAddMenu);

// load on doc ready
document.addEventListener("DOMContentLoaded", loadCategories);
