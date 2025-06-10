// --- App State ---
let currentView = "all"; // or selected

// --- File Upload: Load and Parse CSV ---
document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  const recipes = parseCSV(text);

  // Store in localStorage
  localStorage.setItem("fullRecipes", JSON.stringify(recipes));

  // Display full list by default
  displayAllRecipes();

  // Enable buttons
  document.getElementById('selectBtn').style.display = 'inline-block';
  // document.getElementById('downloadBtn').style.display = 'inline-block';
  // document.getElementById('viewToggleBtn').style.display = 'inline-block';
  alert(`Loaded ${recipes.length} recipes`);
});

// --- Select Menu Button --- 
document.getElementById('selectBtn').addEventListener('click', () => {
  // Get selection criteria
  const meatCount = parseInt(document.getElementById('meatCount').value);
  const fishCount = parseInt(document.getElementById('fishCount').value);
  const threshold = parseInt(document.getElementById('threshold').value);

  // Load stored recipes
  const allRecipes = localStorage.getItem("fullRecipes");
  let allRecipesJSON = JSON.parse(allRecipes);

  // Perform selection
  const selected = selectRecipes(allRecipesJSON, {
    types: { meat: meatCount, fish: fishCount },
    ageThresholdWeeks: threshold
  });

  // Update timestamps for selected recipes
  const now = new Date().toISOString();
  selected.forEach(r => r.last_used = now);

  // Merge updated selection back into full list
  allRecipesJSON = allRecipesJSON.map(r => {
    const updated = selected.find(s => s.name === r.name);
    return updated ? updated : r;
  });

  // Save updated data
  localStorage.setItem("selectedRecipes", JSON.stringify(selected));
  localStorage.setItem("fullRecipes", JSON.stringify(allRecipesJSON));

  // Show selected recipes
  displaySelectedRecipes(JSON.stringify(selected));
  currentView = "selected";

  // Enable buttons
  document.getElementById('downloadBtn').style.display = 'inline-block';
  document.getElementById('viewToggleBtn').style.display = 'inline-block';
});

// --- Download Button: Save CSV or full recipe list ---
document.getElementById('downloadBtn').addEventListener('click', () => {
  const header = "name,type,last_used";
  const full = JSON.parse(localStorage.getItem("fullRecipes"));
  const rows = full.map(r =>
    [r.name, r.type, r.last_used].join(',')
  );
  const csv = [header, ...rows].join("\n");

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'updated_recipes.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// --- View Toggle Button: Switch between full and selected recipe views ---
document.getElementById("viewToggleBtn").addEventListener("click", () => {
  let storageItem;
  let displayFunction;
  let textContent;
  if (currentView === "selected") {
    storageItem = "fullRecipes";
    displayFunction = displayAllRecipes;
    textContent = "View Selected Recipes";
    currentView = "all";
  } else { // currentView === "all"
    storageItem = "selectedRecipes";
    displayFunction = displaySelectedRecipes;
    textContent = "View All Recipes";
    currentView = "selected";
  }

  const chosenRecipes = localStorage.getItem(storageItem);
  chosenRecipes && chosenRecipes.length
    ? displayFunction(chosenRecipes)
    : displayFunction([]);
  document.getElementById("viewToggleBtn").textContent = textContent;
});

// --- Initialize UI from localStorage on page load ---
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  const saved = localStorage.getItem("selectedRecipes");
  const full = localStorage.getItem("fullRecipes");

  if (saved && full) {
    try {
      const selected = JSON.parse(saved);
      recipes = JSON.parse(full);
      // displaySelectedRecipes(selected);
      displayAllRecipes();
      document.getElementById('downloadBtn').style.display = 'inline-block';
      document.getElementById('viewToggleBtn').style.display = 'inline-block';
    } catch (e) {
      console.warn("Failed to parse saved data", e);
    }
  }
});

// =======================
// == Helper Functions ===
// =======================

// --- Parse CSV File into Recipe Array ---
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const [headerLine, ...dataLines] = lines;

  // Parse CSV line using regex to handle quoted commas
  const parseLine = (line) => {
    const regex = /("([^"]|"")*"|[^,]+)(?=\s*,|\s*$)/g;
    const matches = [...line.matchAll(regex)];

    return matches.map(match => {
      let value = match[0].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/""/g, '"');
      }
      return value;
    });
  };

  const headers = parseLine(headerLine);
  return dataLines.map(line => {
    const values = parseLine(line);
    const recipe = {};
    headers.forEach((h, i) => {
      recipe[h] = values[i];
    });
    return recipe;
  });
}

// --- Recipe Selection Logic ---
function selectRecipes(recipes, config) {
  const now = new Date();
  const weeksAgo = (dateStr) => {
    const then = new Date(dateStr);
    return (now - then) / (1000 * 60 * 60 * 24 * 7);
  };

  const selected = [];

  for (const type of Object.keys(config.types)) {
    const count = config.types[type];
    const threshold = config.ageThresholdWeeks;

    const ofType = recipes.filter(r => r.type === type);
    const oldEnough = ofType.filter(r => weeksAgo(r.last_used) >= threshold);

    // Shuffle
    const shuffled = [...oldEnough].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);

    // If not enough, fill in with oldest remaining
    if (picked.length < count) {
      const fallback = ofType
        .filter(r => !picked.includes(r))
        .sort((a, b) => new Date(a.last_used) - new Date(b.last_used));
      picked.push(...fallback.slice(0, count - picked.length));
    }

    selected.push(...picked);
  }

  return selected;
}

// --- Display Selected Recipes as Cards ---
function displaySelectedRecipes(recipes) {
  const output = document.getElementById("output");
  output.innerHTML = "";

  if (!recipes.length) {
    output.innerHTML = "<p>No recipes selected.</p>";
    return;
  }

  const jsonRecipes = JSON.parse(recipes);
  for (const recipe of jsonRecipes) {
    const card = document.createElement("div");
    card.className = "recipe-card";

    card.innerHTML = `
      <strong>${recipe.name}</strong>
      <div>Type: ${recipe.type}</div>
      <div>Last used: ${new Date(recipe.last_used).toLocaleString()}</div>
    `;
    output.appendChild(card);
  }
}

// --- Display All Recipes in a Table ---
function displayAllRecipes() {
  const output = document.getElementById("output");
  output.innerHTML = "";

  const allRecipes = localStorage.getItem("fullRecipes");
  const allRecipesJSON = JSON.parse(allRecipes);
  if (!allRecipesJSON.length) {
    output.innerHTML = "<p>No recipes loaded.</p>";
    return;
  }

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Last Used</th>
      </tr>
    </thead>
    <tbody>
      ${allRecipesJSON.map(r => `
        <tr>
          <td>${r.name}</td>
          <td>${r.type}</td>
          <td>${new Date(r.last_used).toLocaleString()}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  // Add some light styling
  table.querySelectorAll("th, td").forEach(cell => {
    cell.style.border = "1px solid var(--fg)";
    cell.style.padding = "0.5em";
    cell.style.textAlign = "left";
  });

  output.appendChild(table);
}

// --- Toggle Theme (Dark/Light) ---
function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

