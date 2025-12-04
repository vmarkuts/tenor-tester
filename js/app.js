const SEARCH_URL = "https://tenor.googleapis.com/v2/search";
const FEATURED_URL = "https://tenor.googleapis.com/v2/featured";

const CLIENT_KEY = "tenor-tester-front-only";
const LIMIT = 50;
const STORAGE_KEY = "tenorTesterSettings";

const form = document.getElementById("search-form");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const prevBtn = document.getElementById("prev-page");
const nextBtn = document.getElementById("next-page");
const apiKeyInput = document.getElementById("apikey");
const searchInputBlock = document.getElementById("search-input-block");
const contentFilterSelect = document.getElementById("contentfilter");
const queryInput = document.getElementById("query");

// pagination
let currentPos = null;
let nextCursor = null;
let posHistory = [];
let lastQueryOptions = null;

// ------ helpers ------

function getSelectedMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function setSelectedMode(mode) {
  const radio = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (radio) {
    radio.checked = true;
  }
}

function getSelectedKind() {
  return document.querySelector('input[name="kind"]:checked').value;
}

function setSelectedKind(kind) {
  const radio = document.querySelector(`input[name="kind"][value="${kind}"]`);
  if (radio) {
    radio.checked = true;
  }
}

function updateSearchInputVisibility() {
  const mode = getSelectedMode();
  // прячем инпут, если trending
  searchInputBlock.style.display = mode === "search" ? "block" : "none";
}

// ------ localStorage ------

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);

    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
    if (data.mode) {
      setSelectedMode(data.mode);
    }
    if (data.contentfilter) {
      contentFilterSelect.value = data.contentfilter;
    }
    if (data.kind) {
      setSelectedKind(data.kind);
    }
    if (data.q) {
      queryInput.value = data.q;
    }
  } catch (e) {
    console.warn("Failed to load settings from localStorage", e);
  }
}

function saveSettings() {
  try {
    const payload = {
      apiKey: apiKeyInput.value.trim(),
      mode: getSelectedMode(),
      contentfilter: contentFilterSelect.value,
      kind: getSelectedKind(),
      q: queryInput.value.trim()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to save settings to localStorage", e);
  }
}

// ------ main logic ------

async function performSearch(options, reset = false) {
  const { apiKey, q, contentfilter, kind, mode } = options;

  if (!apiKey) {
    statusEl.textContent = "Enter Tenor API key";
    return;
  }

  if (mode === "search" && !q) {
    statusEl.textContent = "Enter search query";
    return;
  }

  if (reset) {
    currentPos = null;
    nextCursor = null;
    posHistory = [];
  }

  resultsEl.innerHTML = "";
  statusEl.textContent = `Loading... (limit=${LIMIT}, mode=${mode})`;

  const params = new URLSearchParams({
    key: apiKey,
    client_key: CLIENT_KEY,
    limit: String(LIMIT),
    contentfilter,
    media_filter: "minimal"
  });

  if (kind === "sticker") {
    params.set("searchfilter", "sticker");
  }

  if (mode === "search") {
    params.set("q", q);
  }

  if (currentPos) {
    params.set("pos", currentPos);
  }

  const baseUrl = mode === "search" ? SEARCH_URL : FEATURED_URL;

  try {
    const resp = await fetch(`${baseUrl}?${params.toString()}`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const results = data.results || [];
    nextCursor = data.next || null;

    if (!results.length) {
      statusEl.textContent = `No results (mode=${mode})`;
    } else {
      statusEl.textContent = `Found ${results.length} items (mode=${mode})`;
    }

    results.forEach((item) => {
      const mf = item.media_formats || {};
      const media =
        mf.tinygif ||
        mf.gif ||
        mf.mediumgif ||
        mf.nanogif ||
        mf.preview;

      if (!media || !media.url) return;

      const div = document.createElement("div");
      div.className = "item";
      const img = document.createElement("img");
      img.src = media.url;
      img.alt = item.content_description || q || "Trending";
      div.appendChild(img);
      resultsEl.appendChild(div);
    });

    prevBtn.disabled = posHistory.length === 0;
    nextBtn.disabled = !nextCursor;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error: " + err.message;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }
}

// ------ event wiring ------

// load saved settings (until first updateSearchInputVisibility)
loadSettings();

// update visibility of input according to current/saved mode 
updateSearchInputVisibility();

// react to mode change
document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener("change", () => {
    updateSearchInputVisibility();
    saveSettings();
  });
});

// save on type change
document.querySelectorAll('input[name="kind"]').forEach((el) => {
  el.addEventListener("change", saveSettings);
});

// save on filter change
contentFilterSelect.addEventListener("change", saveSettings);

// save on blur
apiKeyInput.addEventListener("blur", saveSettings);

// form
form.addEventListener("submit", (evt) => {
  evt.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const q = queryInput.value.trim();
  const contentfilter = contentFilterSelect.value;
  const kind = getSelectedKind();
  const mode = getSelectedMode();

  lastQueryOptions = { apiKey, q, contentfilter, kind, mode };
  saveSettings();
  performSearch(lastQueryOptions, true);
});

// pagination
nextBtn.addEventListener("click", () => {
  if (!nextCursor || !lastQueryOptions) return;
  posHistory.push(currentPos || "");
  currentPos = nextCursor;
  performSearch(lastQueryOptions, false);
});

prevBtn.addEventListener("click", () => {
  if (posHistory.length === 0 || !lastQueryOptions) return;
  currentPos = posHistory.pop() || null;
  performSearch(lastQueryOptions, false);
});
