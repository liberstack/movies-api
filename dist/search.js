import { openModal } from "./modal.js";
// ─── Constants ────────────────────────────────────────────
const API_KEY = "trilogy";
const BASE = "https://www.omdbapi.com/";
const GENRES = [
    "Action", "Adventure", "Animation", "Biography", "Comedy",
    "Crime", "Documentary", "Drama", "Family", "Fantasy",
    "Film-Noir", "History", "Horror", "Music", "Musical",
    "Mystery", "Romance", "Sci-Fi", "Sport", "Thriller", "War", "Western",
];
const COUNTRIES = [
    { label: "USA", match: "United States" },
    { label: "UK", match: "United Kingdom" },
    { label: "Japan", match: "Japan" },
    { label: "France", match: "France" },
    { label: "Germany", match: "Germany" },
    { label: "Italy", match: "Italy" },
    { label: "Soviet Union", match: "Soviet Union" },
    { label: "Australia", match: "Australia" },
    { label: "Canada", match: "Canada" },
    { label: "Spain", match: "Spain" },
    { label: "South Korea", match: "South Korea" },
    { label: "China", match: "China" },
    { label: "India", match: "India" },
    { label: "Brazil", match: "Brazil" },
    { label: "Mexico", match: "Mexico" },
    { label: "Argentina", match: "Argentina" },
    { label: "Sweden", match: "Sweden" },
    { label: "Denmark", match: "Denmark" },
    { label: "Poland", match: "Poland" },
];
// ─── State ────────────────────────────────────────────────
let currentSelectedLi = null;
// ─── Helpers ──────────────────────────────────────────────
function setStatus(msg, isError) {
    const el = document.getElementById("status-msg");
    if (!el)
        return;
    el.textContent = msg;
    el.className = isError ? "error" : "";
}
function buildUrl(title, type, page, y) {
    const params = new URLSearchParams({
        s: title,
        apikey: API_KEY,
        page: String(page),
    });
    if (type)
        params.set("type", type);
    if (y)
        params.set("y", String(y));
    return `${BASE}?${params.toString()}`;
}
// ─── Data fetching ────────────────────────────────────────
async function fetchIds(title, type, startYear, endYear) {
    const yearList = [];
    if (startYear && endYear) {
        for (let y = startYear; y <= endYear; y++)
            yearList.push(y);
    }
    else {
        yearList.push(null);
    }
    const seenIds = new Set();
    const ids = [];
    await Promise.all(yearList.map(async (y) => {
        const data = await fetch(buildUrl(title, type, 1, y))
            .then(r => r.json());
        if (!data.Search)
            return;
        for (const m of data.Search) {
            if (!seenIds.has(m.imdbID)) {
                seenIds.add(m.imdbID);
                ids.push(m.imdbID);
            }
        }
        const total = Math.min(parseInt(data.totalResults ?? "0"), 100);
        const pages = Math.min(Math.ceil(total / 10), 5);
        if (pages > 1) {
            const extras = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => fetch(buildUrl(title, type, i + 2, y))
                .then(r => r.json())));
            for (const p of extras) {
                if (p.Search) {
                    for (const m of p.Search) {
                        if (!seenIds.has(m.imdbID)) {
                            seenIds.add(m.imdbID);
                            ids.push(m.imdbID);
                        }
                    }
                }
            }
        }
    }));
    return ids;
}
// ─── Filtering ────────────────────────────────────────────
function matchesFilters(movie, genreVal, countryVal, startYear, endYear) {
    if (movie.Response !== "True")
        return false;
    if (startYear && endYear) {
        const y = parseInt(movie.Year);
        if (isNaN(y) || y < startYear || y > endYear)
            return false;
    }
    if (genreVal && !movie.Genre?.toLowerCase().includes(genreVal.toLowerCase()))
        return false;
    if (countryVal) {
        const movieCountries = (movie.Country ?? "").split(",").map(c => c.trim().toLowerCase());
        if (!movieCountries.some(c => c.includes(countryVal.toLowerCase())))
            return false;
    }
    return true;
}
// ─── Rendering ────────────────────────────────────────────
function renderMovieLi(movie, listEl) {
    const li = document.createElement("li");
    const rating = movie.imdbRating && movie.imdbRating !== "N/A"
        ? ` &middot; &#9733; ${movie.imdbRating}` : "";
    li.innerHTML = `
    <div class="movie-title">${movie.Title}</div>
    <div class="movie-meta">${movie.Year} &middot; ${movie.Runtime}${rating}</div>
  `;
    li.addEventListener("click", () => {
        currentSelectedLi?.classList.remove("active");
        li.classList.add("active");
        currentSelectedLi = li;
        openModal(movie);
    });
    listEl.appendChild(li);
}
// ─── Search orchestration ─────────────────────────────────
async function searchMovies(title, type, genreVal, countryVal) {
    const decadeFilter = document.getElementById("decade-filter");
    const resultsEl = document.getElementById("results");
    const resultCountEl = document.getElementById("result-count");
    const startYear = decadeFilter.value ? parseInt(decadeFilter.value) : null;
    const endYear = startYear ? startYear + 9 : null;
    setStatus("Searching...", false);
    resultsEl.innerHTML = "";
    resultCountEl.textContent = "";
    try {
        const ids = await fetchIds(title, type, startYear, endYear);
        if (!ids.length) {
            setStatus("No results found.", true);
            resultsEl.innerHTML = `<li class="empty-state">No results.</li>`;
            return;
        }
        setStatus(`Loading details for ${ids.length} results...`, false);
        const details = await Promise.all(ids.map(id => fetch(`${BASE}?i=${id}&apikey=${API_KEY}&plot=full`)
            .then(r => r.json())));
        const results = details
            .filter(d => matchesFilters(d, genreVal, countryVal, startYear, endYear))
            .sort((a, b) => (parseFloat(b.imdbRating) || 0) - (parseFloat(a.imdbRating) || 0));
        if (!results.length) {
            setStatus("No results found for those filters.", true);
            resultsEl.innerHTML = `<li class="empty-state">No results.</li>`;
            resultCountEl.textContent = "";
            return;
        }
        setStatus("", false);
        resultCountEl.textContent = `${results.length} result${results.length !== 1 ? "s" : ""}`;
        results.forEach(m => renderMovieLi(m, resultsEl));
    }
    catch (err) {
        console.error(err);
        setStatus("Connection error.", true);
    }
}
// ─── Page render ──────────────────────────────────────────
export function renderSearch(app) {
    currentSelectedLi = null;
    const genreOptions = `<option value="">All genres</option>` +
        GENRES.map(g => `<option value="${g}">${g}</option>`).join("");
    const countryOptions = `<option value="">All countries</option>` +
        COUNTRIES.map(c => `<option value="${c.match}">${c.label}</option>`).join("");
    app.innerHTML = `
    <div class="search-area">
      <h2>Search database</h2>

      <div class="search-block">
        <label class="search-label" for="search">Title</label>
        <input id="search" type="text"
          placeholder="e.g. Blade Runner, The Godfather, Metropolis..."
          autocomplete="off" />
      </div>

      <div class="search-block search-block--divided">
        <label class="search-label">Filters</label>
        <div class="search-filters-grid">
          <select id="type-filter">
            <option value="">All types</option>
            <option value="movie">Movie</option>
            <option value="series">Series</option>
            <option value="episode">Episode</option>
          </select>
          <select id="decade-filter">
            <option value="">All decades</option>
            <option value="1920">1920s</option>
            <option value="1930">1930s</option>
            <option value="1940">1940s</option>
            <option value="1950">1950s</option>
            <option value="1960">1960s</option>
            <option value="1970">1970s</option>
            <option value="1980">1980s</option>
            <option value="1990">1990s</option>
            <option value="2000">2000s</option>
            <option value="2010">2010s</option>
            <option value="2020">2020s</option>
          </select>
          <select id="genre-filter">${genreOptions}</select>
          <select id="country-filter">${countryOptions}</select>
        </div>
        <p class="search-hint">All fields are optional — use any combination.</p>
      </div>

      <button class="btn-search btn-search--full" id="btn-search">Search</button>

      <div id="status-msg"></div>
    </div>

    <div class="content">
      <div class="ranks-col">
        <div class="results-col" id="results-col">
          <div class="results-header">
            <h3>Results</h3>
            <span id="result-count"></span>
          </div>
          <ul id="results"></ul>
        </div>
      </div>
    </div>
  `;
    const searchInput = document.getElementById("search");
    const typeEl = document.getElementById("type-filter");
    const genreEl = document.getElementById("genre-filter");
    const countryEl = document.getElementById("country-filter");
    const btnSearch = document.getElementById("btn-search");
    function doSearch() {
        const titleQ = searchInput.value.trim();
        const typeQ = typeEl.value;
        const genreQ = genreEl.value;
        const countryQ = countryEl.value;
        if (!titleQ) {
            const statusEl = document.getElementById("status-msg");
            statusEl.textContent = "Enter a title to search.";
            statusEl.className = "error";
            return;
        }
        searchMovies(titleQ, typeQ, genreQ, countryQ);
    }
    btnSearch.addEventListener("click", doSearch);
    searchInput.addEventListener("keydown", e => { if (e.key === "Enter")
        doSearch(); });
}
