// base backend URL
const BASE_URL = "https://smartday-personal-productivity-tracker.onrender.com/api";

// get main elements
const menuDropdown = document.getElementById("menuDropdown");
const addMenuBtn = document.getElementById("addMenuBtn");
const contentArea = document.getElementById("contentArea");

let categories = []; // store loaded categories

// load all categories from backend
async function loadCategories() {
  try {
    const res = await fetch(`${BASE_URL}/get_categories/`);
    const data = await res.json();
    categories = data.categories || [];

    menuDropdown.innerHTML = "";
    contentArea.innerHTML = "";

    for (const cat of categories) {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      menuDropdown.appendChild(opt);
      createCategoryContainer(cat);
    }

    if (categories.length) {
      menuDropdown.value = String(categories[0].id);
      showCategory(String(categories[0].id));
    } else {
      showEmptyMessage();
    }
  } catch (err) {
    console.error("loadCategories failed:", err);
  }
}

// show only selected category
function showCategory(categoryId) {
  document.querySelectorAll("#contentArea > div").forEach(div => div.style.display = "none");
  const container = document.getElementById(`container-${categoryId}`);
  if (container) container.style.display = "block";
}

// create category container (task/routine)
function createCategoryContainer(cat) {
  const container = document.createElement("div");
  container.id = `container-${cat.id}`;
  container.classList.add(cat.type === "task" ? "taskContainer" : "routineContainer");
  container.dataset.categoryId = cat.id;

  const isTask = cat.type === "task";
  const items = cat.items || [];

  container.innerHTML = `
    <h2>${cat.name}</h2>
    <div class="task-input">
      ${isTask ? `
        <input type="text" class="taskInput" placeholder="Enter your task..." />
      ` : `
        <input type="time" class="routineTime" value="07:00" />
        <input type="text" class="routineInput" placeholder="What's your routine?" />
      `}
      <button class="${isTask ? "addTaskBtn" : "addRoutineBtn"}">+</button>
    </div>
    <div class="filter-container">
      <button class="filter-btn active" data-filter="all">All (<span class="count-all">0</span>)</button>
      <button class="filter-btn" data-filter="active">Active (<span class="count-active">0</span>)</button>
      <button class="filter-btn" data-filter="completed">Completed (<span class="count-completed">0</span>)</button>
    </div>
    <ul class="${isTask ? "taskList" : "routineList"}"></ul>
  `;

  contentArea.appendChild(container);
  const listEl = container.querySelector("ul");
  items.forEach(i => appendItemToList(listEl, i));

  // add item
  const addBtn = container.querySelector("button");
  addBtn.addEventListener("click", async () => {
    const titleInput = container.querySelector(isTask ? ".taskInput" : ".routineInput");
    const timeInput = container.querySelector(".routineTime");
    const text = titleInput ? titleInput.value.trim() : "";
    const time = timeInput ? timeInput.value : "";
    if (!text) return;

    try {
      const res = await fetch(`${BASE_URL}/add_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: cat.id, title: text, time: time || null })
      });
      const data = await res.json();
      appendItemToList(listEl, data);
    } catch {
      appendItemToList(listEl, { title: text, status: "active", time });
    }
    if (titleInput) titleInput.value = "";
  });

  // filters
  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter(listEl, btn.dataset.filter);
    });
  });

  updateCounts(listEl);
}

// filter items
function applyFilter(listEl, filter) {
  listEl.querySelectorAll("li").forEach(li => {
    const isCompleted = li.classList.contains("completed-task");
    li.style.display =
      filter === "all" ||
      (filter === "completed" && isCompleted) ||
      (filter === "active" && !isCompleted)
        ? "flex"
        : "none";
  });
}

// add item to list
function appendItemToList(listEl, item) {
  const li = document.createElement("li");
  if (item.status === "completed") li.classList.add("completed-task");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.status === "completed";

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
  delBtn.classList.add("delete-btn");

  // toggle status
  checkbox.addEventListener("change", async () => {
    li.classList.toggle("completed-task", checkbox.checked);
    updateCounts(listEl);
    try {
      await fetch(`${BASE_URL}/toggle_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id })
      });
    } catch {}
  });

  // delete item
  delBtn.addEventListener("click", async () => {
    li.remove();
    updateCounts(listEl);
    try {
      await fetch(`${BASE_URL}/delete_item/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id })
      });
    } catch {}
  });

  li.appendChild(delBtn);
  listEl.appendChild(li);
  updateCounts(listEl);
}

// update item counts
function updateCounts(listEl) {
  const container = listEl.closest("div");
  if (!container) return;
  const all = listEl.querySelectorAll("li").length;
  const completed = listEl.querySelectorAll(".completed-task").length;
  const active = all - completed;
  container.querySelector(".count-all").textContent = all;
  container.querySelector(".count-active").textContent = active;
  container.querySelector(".count-completed").textContent = completed;
}

// show inline add menu input
function showInlineAddMenu() {
  if (document.getElementById("inline-add-menu")) return;

  const wrapper = document.createElement("div");
  wrapper.id = "inline-add-menu";
  wrapper.style.display = "flex";
  wrapper.style.gap = "8px";
  wrapper.style.margin = "8px 0";

  const nameInput = document.createElement("input");
  nameInput.placeholder = "Menu name";
  nameInput.style.padding = "6px";
  nameInput.style.minWidth = "160px";

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
  menuDropdown.parentNode.insertBefore(wrapper, menuDropdown.nextSibling);

  cancelBtn.addEventListener("click", () => wrapper.remove());
  addBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const type = typeSelect.value;
    if (!name) return;

    try {
      const res = await fetch(`${BASE_URL}/add_category/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type })
      });
      const data = await res.json();
      categories.push(data);

      const opt = document.createElement("option");
      opt.value = String(data.id);
      opt.textContent = data.name;
      menuDropdown.appendChild(opt);
      menuDropdown.value = String(data.id);
      createCategoryContainer(data);
      showCategory(String(data.id));
    } catch (err) {
      console.error("add_category failed:", err);
    } finally {
      wrapper.remove();
    }
  });
}

// delete menu silently (no alert/confirm)
async function deleteCurrentMenu() {
  const categoryId = menuDropdown.value;
  if (!categoryId) return;

  const category = categories.find(c => String(c.id) === String(categoryId));
  if (!category) return;

  try {
    await fetch(`${BASE_URL}/delete_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId })
    });

    categories = categories.filter(c => String(c.id) !== String(categoryId));
    const opt = menuDropdown.querySelector(`option[value="${categoryId}"]`);
    if (opt) opt.remove();

    const container = document.getElementById(`container-${categoryId}`);
    if (container) container.remove();

    if (categories.length) {
      menuDropdown.value = String(categories[0].id);
      showCategory(String(categories[0].id));
    } else {
      showEmptyMessage("Menu deleted.");
    }
  } catch (err) {
    console.error("delete_category failed:", err);
    showEmptyMessage("Failed to delete menu.");
  }
}

// show empty notice text
function showEmptyMessage(text = "No menus yet. Click Add Menu.") {
  contentArea.innerHTML = `<p style="color:#666;text-align:center;margin-top:16px">${text}</p>`;
}

// buttons
addMenuBtn.addEventListener("click", showInlineAddMenu);

// create delete menu button beside add menu
const deleteMenuBtn = document.createElement("button");
deleteMenuBtn.id = "deleteMenuBtn";
deleteMenuBtn.textContent = "🗑️ Delete Menu";
deleteMenuBtn.style.marginLeft = "8px";
deleteMenuBtn.style.background = "#e74c3c";
deleteMenuBtn.style.color = "white";
deleteMenuBtn.style.border = "none";
deleteMenuBtn.style.padding = "6px 10px";
deleteMenuBtn.style.borderRadius = "6px";
addMenuBtn.parentNode.insertBefore(deleteMenuBtn, addMenuBtn.nextSibling);

deleteMenuBtn.addEventListener("click", deleteCurrentMenu);

// show category when dropdown changes
menuDropdown.addEventListener("change", e => showCategory(e.target.value));

// load data
document.addEventListener("DOMContentLoaded", loadCategories);
