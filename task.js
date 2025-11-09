
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

// append a task/routine item to a list (used when loading existing items)
// Updated helper to append an item to a list and wire checkbox + delete to backend
// helper to read CSRF cookie (useful if you remove @csrf_exempt later)
// helper to read CSRF cookie (useful if you remove @csrf_exempt later)
function getCSRFToken() {
  const match = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
  return match ? match.split('=')[1] : '';
}

// Updated appendItemToList with logging and CSRF support
function appendItemToList(listEl, item) {
  const li = document.createElement("li");
  if (item.id) li.dataset.itemId = item.id;
  if (item.status === "completed") li.classList.add("completed-task");

  // checkbox
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.status === "completed";

  checkbox.addEventListener("change", async () => {
    const isChecked = checkbox.checked;
    // optimistic UI update
    li.classList.toggle("completed-task", isChecked);
    updateCounts(listEl);

    if (!item.id) {
      console.log("Local-only item toggled (no server id).");
      return;
    }

    try {
      console.log("Calling /toggle_item/ for item", item.id, "-> checked:", isChecked);
      const res = await fetch("/toggle_item/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // "X-CSRFToken": getCSRFToken(), // uncomment if you enforce CSRF
        },
        body: JSON.stringify({ item_id: item.id })
      });

      console.log("toggle_item HTTP status:", res.status);
      if (!res.ok) throw new Error(`toggle_item returned ${res.status}`);

      const data = await res.json();
      console.log("toggle_item response:", data);
      // sync UI with server's response
      const newStatus = data.new_status;
      const shouldBeChecked = newStatus === "completed";
      checkbox.checked = shouldBeChecked;
      li.classList.toggle("completed-task", shouldBeChecked);
      updateCounts(listEl);
    } catch (err) {
      console.error("toggle_item error:", err);
      // rollback optimistic change
      checkbox.checked = !isChecked;
      li.classList.toggle("completed-task", !isChecked);
      updateCounts(listEl);
      alert("Failed to change item status on server. See console for details.");
    }
  });

  // title
  const titleSpan = document.createElement("span");
  titleSpan.textContent = item.title || "";

  // optional time for routines
  if (item.time) {
    const timeSpan = document.createElement("span");
    timeSpan.classList.add("routine-time");
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

  delBtn.addEventListener("click", async () => {
    // optimistic remove
    const nextSibling = li.nextSibling;
    li.remove();
    updateCounts(listEl);

    if (!item.id) {
      console.log("Local-only item removed.");
      return;
    }

    try {
      console.log("Calling /delete_item/ for item", item.id);
      const res = await fetch("/delete_item/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // "X-CSRFToken": getCSRFToken(), // uncomment if you enforce CSRF
        },
        body: JSON.stringify({ item_id: item.id })
      });

      console.log("delete_item HTTP status:", res.status);
      if (!res.ok) throw new Error(`delete_item returned ${res.status}`);

      const data = await res.json();
      console.log("delete_item response:", data);
      if (data.status !== "ok") throw new Error(data.message || "delete failed");
      // success — nothing else to do
    } catch (err) {
      console.error("delete_item error:", err);
      // rollback: re-insert the li
      if (nextSibling) listEl.insertBefore(li, nextSibling);
      else listEl.appendChild(li);
      updateCounts(listEl);
      alert("Failed to delete item on server. See console for details.");
    }
  });

  li.appendChild(delBtn);
  listEl.appendChild(li);

  // initial counts update
  updateCounts(listEl);
}



// update counters display inside container
function updateCounts(listEl) {
  const container = listEl.closest("div");
  if (!container) return;
  const all = listEl.querySelectorAll("li").length;
  const completed = listEl.querySelectorAll("li.completed-task").length;
  const active = all - completed;
  const cAll = container.querySelector(".count-all");
  const cActive = container.querySelector(".count-active");
  const cCompleted = container.querySelector(".count-completed");
  if (cAll) cAll.textContent = all;
  if (cActive) cActive.textContent = active;
  if (cCompleted) cCompleted.textContent = completed;
}

// create task container and wire listeners
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

  const addLocal = container.querySelector(".addTaskBtn");
  const inputEl = container.querySelector(".taskInput");
  const listEl = container.querySelector(".taskList");
  const filterBtns = container.querySelectorAll(".filter-btn");

  // filter logic
  let currentFilter = "all";
  filterBtns.forEach(b => b.addEventListener("click", () => {
    filterBtns.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    currentFilter = b.dataset.filter;
    listEl.querySelectorAll("li").forEach(li => {
      const isCompleted = li.classList.contains("completed-task");
      if (currentFilter === "all") li.style.display = "";
      else if (currentFilter === "active") li.style.display = isCompleted ? "none" : "";
      else li.style.display = isCompleted ? "" : "none";
    });
  }));

  addLocal.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    const catId = container.dataset.categoryId;
    try {
      const res = await fetch("/add_item/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: catId, title: text })
      });
      if (!res.ok) throw new Error("add_item failed");
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status });
    } catch (err) {
      console.error("add_item error, falling back to local:", err);
      appendItemToList(listEl, { title: text, status: "active" });
    }
    inputEl.value = "";
    updateCounts(listEl);
  });

  inputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") addLocal.click(); });

  // populate existing items
  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// create routine container and wire listeners
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

  const addLocal = container.querySelector(".addRoutineBtn");
  const inputEl = container.querySelector(".routineInput");
  const timeEl = container.querySelector(".routineTime");
  const listEl = container.querySelector(".routineList");
  const filterBtns = container.querySelectorAll(".filter-btn");

  let currentFilter = "all";
  filterBtns.forEach(b => b.addEventListener("click", () => {
    filterBtns.forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    currentFilter = b.dataset.filter;
    listEl.querySelectorAll("li").forEach(li => {
      const isCompleted = li.classList.contains("completed-task");
      if (currentFilter === "all") li.style.display = "";
      else if (currentFilter === "active") li.style.display = isCompleted ? "none" : "";
      else li.style.display = isCompleted ? "" : "none";
    });
  }));

  addLocal.addEventListener("click", async () => {
    const text = inputEl.value.trim();
    const time = timeEl.value;
    if (!text) return;
    const catId = container.dataset.categoryId;
    try {
      const res = await fetch("/add_item/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: catId, title: text, time })
      });
      if (!res.ok) throw new Error("add_item failed");
      const data = await res.json();
      appendItemToList(listEl, { id: data.id, title: data.title, status: data.status, time: data.time });
    } catch (err) {
      console.error("add_routine error, fallback to local:", err);
      appendItemToList(listEl, { title: text, status: "active", time });
    }
    inputEl.value = "";
    updateCounts(listEl);
  });

  inputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") addLocal.click(); });

  items.forEach(i => appendItemToList(listEl, i));
  updateCounts(listEl);
}

// helper to create a category on the backend and return {id, name, type}
async function createCategoryOnServer(name, type) {
  const res = await fetch("/add_category/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type })
  });
  if (!res.ok) throw new Error("add_category failed");
  return await res.json();
}

// If DB empty, create Task 1 + Routine 1 on the first Add click
async function seedDefaultsIfEmpty() {
  if (dropdown.options.length > 0) return false; // already populated
  try {
    // create Task 1 and Routine 1 on server
    const t = await createCategoryOnServer("Task 1", "task");
    const r = await createCategoryOnServer("Routine 1", "routine");

    // add to dropdown and containers
    const optT = document.createElement("option");
    optT.value = `cat${t.id}`;
    optT.textContent = t.name;
    dropdown.appendChild(optT);
    createTaskContainer(optT.value, t.name, t.id, []);

    const optR = document.createElement("option");
    optR.value = `cat${r.id}`;
    optR.textContent = r.name;
    dropdown.appendChild(optR);
    createRoutineContainer(optR.value, r.name, r.id, []);

    // set counters to 1
    taskCount = 1;
    routineCount = 1;

    // select the Task 1 by default
    dropdown.value = optT.value;
    showSelectedContainer();

    return true;
  } catch (err) {
    console.error("Failed to seed defaults:", err);
    return false;
  }
}

// load categories from backend and populate UI
async function loadCategories() {
  try {
    const res = await fetch("/get_categories/");
    if (!res.ok) {
      console.error("GET /get_categories/ returned", res.status);
      return;
    }
    const data = await res.json();

    // reset UI
    dropdown.innerHTML = "";
    contentArea.innerHTML = "";

    let taskMax = 0;
    let routineMax = 0;

    (data.categories || []).forEach(cat => {
      const value = `cat${cat.id}`;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = cat.name;
      dropdown.appendChild(option);

      if (cat.type === "task") {
        createTaskContainer(value, cat.name, cat.id, cat.items || []);
        const n = parseInt(cat.name.split(" ")[1] || "0", 10);
        if (!isNaN(n)) taskMax = Math.max(taskMax, n);
      } else {
        createRoutineContainer(value, cat.name, cat.id, cat.items || []);
        const n = parseInt(cat.name.split(" ")[1] || "0", 10);
        if (!isNaN(n)) routineMax = Math.max(routineMax, n);
      }
    });

    taskCount = taskMax;
    routineCount = routineMax;

    // If DB empty (no options), don't auto-create defaults here; wait for first Add click to seed
    if (dropdown.options.length) {
      // select latest (most recently created)
      dropdown.value = dropdown.options[dropdown.options.length - 1].value;
      showSelectedContainer();
    }
  } catch (err) {
    console.error("loadCategories failed:", err);
  }
}

// add menu button handler
addBtn.addEventListener("click", async () => {
  // If DB was empty, create Task 1 & Routine 1 and stop (user clicked to "seed" menus).
  const seeded = await seedDefaultsIfEmpty();
  if (seeded) return; // first click seeded both defaults; subsequent clicks behave normally

  // Normal behavior: create a new menu of the selected type
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

    // add to dropdown & create container
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    dropdown.appendChild(option);

    if (selectedType === "task") createTaskContainer(value, name, data.id);
    else createRoutineContainer(value, name, data.id);

    // switch to new menu
    dropdown.value = value;
    showSelectedContainer();
  } catch (err) {
    console.error("Failed to create new menu:", err);
  }
});

// wire dropdown change
dropdown.addEventListener("change", showSelectedContainer);

// start
document.addEventListener("DOMContentLoaded", loadCategories);
