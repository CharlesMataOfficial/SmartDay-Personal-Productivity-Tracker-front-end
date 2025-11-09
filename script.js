// Base URL of your backend API
const API_BASE = "https://smartday-personal-productivity-tracker.onrender.com/api";

// get container for menus
const menuContainer = document.getElementById("contentArea");
const addMenuBtn = document.getElementById("addMenuBtn");

// load categories from backend
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/get_categories/`);
    if (!res.ok) throw new Error("Failed to load categories");
    const data = await res.json();
    displayCategories(data.categories);
  } catch (err) {
    console.error("loadCategories failed:", err);
  }
}

// show all categories in container
function displayCategories(categories) {
  menuContainer.innerHTML = ""; // clear
  categories.forEach(cat => {
    const div = document.createElement("div");
    div.classList.add("menu-box");
    div.dataset.id = cat.id;
    div.innerHTML = `
      <div class="menu-header">
        <h3>${cat.name}</h3>
        <button class="delete-btn">✕</button>
      </div>
      <div class="items"></div>
    `;

    // delete button click
    div.querySelector(".delete-btn").addEventListener("click", async () => {
      await deleteCategoryFromServer(cat.id);
      div.remove(); // remove from UI
    });

    menuContainer.appendChild(div);
  });
}

// add new category to server
async function createCategoryOnServer(name, type) {
  try {
    const res = await fetch(`${API_BASE}/add_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type })
    });
    if (!res.ok) throw new Error("add_category failed");
    return await res.json();
  } catch (err) {
    console.error("Failed to create new menu:", err);
  }
}

// delete category from server (no alert)
async function deleteCategoryFromServer(categoryId) {
  try {
    const res = await fetch(`${API_BASE}/delete_category/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId })
    });
    if (!res.ok) throw new Error("delete_category failed");
    const data = await res.json();
    if (data.status === "ok") {
      console.log(`Category ${categoryId} deleted`);
    }
  } catch (err) {
    console.error("Failed to delete category:", err);
  }
}

// handle "Add Menu" button click
addMenuBtn.addEventListener("click", async () => {
  const name = prompt("Enter menu name:");
  if (!name) return;
  const newCat = await createCategoryOnServer(name, "task");
  if (newCat) {
    displayCategories([newCat]); // add new one
  }
});

// run on page load
document.addEventListener("DOMContentLoaded", loadCategories);
