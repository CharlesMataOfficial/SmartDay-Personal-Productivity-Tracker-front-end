// base url to your backend api
const BASE_URL = "https://smartday-personal-productivity-tracker.onrender.com/api";

// cached DOM refs
const menuDropdown = document.getElementById("menuDropdown");
const addMenuBtn = document.getElementById("addMenuBtn");
const contentArea = document.getElementById("contentArea");

// store categories locally
let categories = [];

// load categories from backend
async function loadCategories() {
  try {
    const res = await fetch(`${BASE_URL}/get_categories/`);
    if (!res.ok) throw new Error(`get_categories ${res.status}`);
    const payload = await res.json();
    // handle either { categories: [...] } or direct array
    const data = Array.isArray(payload) ? payload : payload.categories || [];
    categories = data;

    menuDropdown.innerHTML = "";
    data.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = String(cat.id);
      opt.textContent = cat.name;
      menuDropdown.appendChild(opt);
    });

    // show the first category automatically
    if (data.length) {
      const first = data[0];
      menuDropdown.value = String(first.id);
      await showCategory(String(first.id));
    } else {
      contentArea.innerHTML = "<p style='color:#666'>No categories yet. Click Add Menu to create one.</p>";
    }
  } catch (err) {
    console.error("loadCategories failed:", err);
    contentArea.innerHTML = "<p style='color:red'>Failed to load categories. Check console.</p>";
  }
}

// show category by id (loads items then renders container)
async function showCategory(categoryId) {
  // remove any existing container for that category
  const existing = document.querySelector(`#container-${categoryId}`);
  if (existing) existing.remove();

  // find category meta
  const cat = categories.find(c => String(c.id) === String(categoryId));
  if (!cat) {
    console.warn("category not found locally:", categoryId);
    return;
  }

  // fetch items for the category
  let items = [];
  try {
    const res = await fetch(`${BASE_URL}/get_items/${categoryId}/`);
    if (!res.ok) {
      console.warn("get_items returned", res.status);
    } else {
      const payload = await res.json();
      // if endpoint returns an object like { items: [...] } or returns list directly
      items = payload.items || (Array.isArray(payload) ? payload : []);
    }
  } catch (err) {
    console.error("Failed to fetch items:", err);
  }

  // create container based on type
  if (cat.type === "routine") createRoutineContainer(`container-${categoryId}`, cat.name, categoryId, items);
  else createTaskContainer(`container-${categoryId}`, cat.name, categoryId, items);

  // show that container
  document.querySelectorAll("#contentArea > div").forEach(div => div.style.display = "none");
  const shown = document.getElementById(`container-${categoryId}`);
  if (shown) shown.style.display = "block";
}

// create a single item element and wire checkbox + delete
function appendItemToList(listEl, item) {
  const li = document.createElement("li");
  li.dataset.itemId = item.id ?? "";
  li.className = item.status === "completed" ? "completed-task" : "";
  li.style.display = ""; // default visible

  // checkbox element
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.status === "completed";

  // title
  const titleSpan = document.createElement("span");
  titleSpan.textContent = item.title || "";

  // optional time (for routines)
  if (item.time) {
    const timeSpan = document.createElement("span");
    timeSpan.className = "routine-time";
    timeSpan.textContent = item.time;
    li.appendChild(checkbox);
    li.appendChild(timeSpan);
    li.appendChild(titleSpan);
  } else {
    li.appendChild(checkbox);
    li.appendChild(titleSpan);
  }

  // delete button
  const delBtn = document.createElement("button");
  delBtn.innerHTML = "🗑️";
  delBtn.className = "delete-btn";

  // toggle event
  checkbox.addEventListener("change", async () => {
    const newChecked = checkbox.checked;
    li.classList.toggle("completed-task", newChecked);
    updateCounts(listEl);

    const itemId = li.dataset.itemId;
    if (!itemId) return;

    try {
      const res = await fetch(`${BASE_URL}/toggle_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId })
      });
      if (!res.ok) throw new Error(`toggle_item ${res.status}`);
      // optional: read response to sync
      const r = await res.json().catch(()=>null);
      if (r && r.new_status) {
        const shouldBeChecked = r.new_status === "completed";
        checkbox.checked = shouldBeChecked;
        li.classList.toggle("completed-task", shouldBeChecked);
      }
      updateCounts(listEl);
    } catch (err) {
      console.error("toggle_item failed:", err);
      // rollback
      checkbox.checked = !newChecked;
      li.classList.toggle("completed-task", !newChecked);
      updateCounts(listEl);
      alert("Couldn't update item on server.");
    }
  });

  // delete event
  delBtn.addEventListener("click", async () => {
    const next = li.nextSibling;
    li.remove();
    updateCounts(listEl);

    const itemId = li.dataset.itemId;
    if (!itemId) return;

    try {
      const res = await fetch(`${BASE_URL}/delete_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId })
      });
      if (!res.ok) throw new Error(`delete_item ${res.status}`);
      // success
    } catch (err) {
      console.error("delete_item failed:", err);
      // rollback
      if (next) listEl.insertBefore(li, next);
      else listEl.appendChild(li);
      updateCounts(listEl);
      alert("Couldn't delete item on server.");
    }
  });

  li.appendChild(delBtn);
  listEl.appendChild(li);
  updateCounts(listEl);
}

// update counters for a container
function updateCounts(listEl) {
  const container = listEl.closest(".taskContainer, .routineContainer");
  if (!container) return;
  const all = listEl.querySelectorAll("li").length;
  const completed = listEl.querySelectorAll("li.completed-task").length;
  const active = all - completed;
  const allEl = container.querySelector(".count-all");
  const activeEl = container.querySelector(".count-active");
  const compEl = container.querySelector(".count-completed");
  if (allEl) allEl.textContent = all;
  if (activeEl) activeEl.textContent = active;
  if (compEl) compEl.textContent = completed;
}

// create task container with filters wired
function createTaskContainer(id, title, categoryId, items = []) {
  if (document.getElementById(id)) return;
  const container = document.createElement("div");
  container.id = id;
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
  const filterBtns = container.querySelectorAll(".filter-btn");
  let currentFilter = "all";

  // filter click handlers
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      listEl.querySelectorAll("li").forEach(li => {
        const done = li.classList.contains("completed-task");
        if (currentFilter === "all") li.style.display = "";
        else if (currentFilter === "active") li.style.display = done ? "none" : "";
        else li.style.display = done ? "" : "none";
      });
    });
  });

  // add item logic
  addBtn.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    try {
      const res = await fetch(`${BASE_URL}/add_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, title: text })
      });
      if (!res.ok) throw new Error(`add_item ${res.status}`);
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status });
    } catch (err) {
      console.error("add_item failed:", err);
      // fallback local
      appendItemToList(listEl, { title: text, status: "active" });
    }
    inputEl.value = "";
    // re-apply filter
    filterBtns.forEach(b => { if (b.dataset.filter === currentFilter) b.click(); });
  });

  inputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") addBtn.click(); });

  items.forEach(it => appendItemToList(listEl, it));
  updateCounts(listEl);
}

// create routine container (same as tasks plus time)
function createRoutineContainer(id, title, categoryId, items = []) {
  if (document.getElementById(id)) return;
  const container = document.createElement("div");
  container.id = id;
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
  const filterBtns = container.querySelectorAll(".filter-btn");
  let currentFilter = "all";

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      listEl.querySelectorAll("li").forEach(li => {
        const done = li.classList.contains("completed-task");
        if (currentFilter === "all") li.style.display = "";
        else if (currentFilter === "active") li.style.display = done ? "none" : "";
        else li.style.display = done ? "" : "none";
      });
    });
  });

  addBtn.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    const time = timeEl.value;
    if (!text) return;
    try {
      const res = await fetch(`${BASE_URL}/add_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, title: text, time })
      });
      if (!res.ok) throw new Error(`add_item ${res.status}`);
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status, time: data.time });
    } catch (err) {
      console.error("add_routine failed:", err);
      appendItemToList(listEl, { title: text, status: "active", time });
    }
    inputEl.value = "";
    filterBtns.forEach(b => { if (b.dataset.filter === currentFilter) b.click(); });
  });

  inputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") addBtn.click(); });

  items.forEach(it => appendItemToList(listEl, it));
  updateCounts(listEl);
}

// show a small inline add-menu form (no prompt)
function showInlineAddMenu() {
  // don't create duplicates
  if (document.getElementById("inline-add-menu")) return;

  const wrapper = document.createElement("div");
  wrapper.id = "inline-add-menu";
  wrapper.style.display = "flex";
  wrapper.style.gap = "8px";
  wrapper.style.margin = "8px 0";

  const nameInput = document.createElement("input");
  nameInput.placeholder = "Menu name";
  nameInput.style.padding = "6px";
  nameInput.style.minWidth = "180px";

  const typeSelect = document.createElement("select");
  const opt1 = document.createElement("option"); opt1.value = "task"; opt1.text = "task";
  const opt2 = document.createElement("option"); opt2.value = "routine"; opt2.text = "routine";
  typeSelect.append(opt1, opt2);

  const addBtn = document.createElement("button");
  addBtn.textContent = "Create";
  addBtn.style.background = "#8411FF";
  addBtn.style.color = "#fff";
  addBtn.style.border = "none";
  addBtn.style.padding = "6px 10px";
  addBtn.style.borderRadius = "6px";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.padding = "6px 10px";

  wrapper.append(nameInput, typeSelect, addBtn, cancelBtn);
  // insert after dropdown
  menuDropdown.parentNode.insertBefore(wrapper, menuDropdown.nextSibling);

  cancelBtn.addEventListener("click", () => wrapper.remove());
  addBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const type = typeSelect.value;
    if (!name) return; // require name

    try {
      const res = await fetch(`${BASE_URL}/add_category/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type })
      });
      if (!res.ok) throw new Error(`add_category ${res.status}`);
      const data = await res.json();
      categories.push(data);

      // add option and show it
      const opt = document.createElement("option");
      opt.value = String(data.id);
      opt.textContent = data.name;
      menuDropdown.appendChild(opt);
      menuDropdown.value = String(data.id);
      await showCategory(String(data.id));
    } catch (err) {
      console.error("add_category failed:", err);
      alert("Failed to create menu.");
    } finally {
      wrapper.remove();
    }
  });
}

// wire add menu button
addMenuBtn.addEventListener("click", showInlineAddMenu);

// wire dropdown change
menuDropdown.addEventListener("change", (e) => {
  showCategory(e.target.value);
});

// initial load
document.addEventListener("DOMContentLoaded", loadCategories);
