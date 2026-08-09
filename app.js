let state = {
  user: null,
  permissions: {},
  scores: [],
  books: [],
  history: [],
  logs: [],
  users: [],
};
let historySearchQuery = "";
let selectedBookId = "";
let bookMode = "list";
let permissionMode = "users";

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || "요청을 처리하지 못했습니다.");
  return payload;
}

async function loadState() {
  const payload = await api("/api/state");
  state = payload;
  render();
}

function can(permission) {
  return Boolean(state.user?.permissions?.[permission]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function pulseSync(text = "서버 저장 중") {
  const sync = $("#syncStatus");
  if (!sync) return;
  sync.textContent = text;
  window.setTimeout(() => {
    sync.textContent = "동기화 완료";
  }, 450);
}

function showApp(isLoggedIn) {
  $("#authScreen").classList.toggle("hidden", isLoggedIn);
  $(".app-shell").classList.toggle("ready", isLoggedIn);
}

function switchView(viewId) {
  $all(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  $all(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewId));
  const titles = {
    home: "이번 주 준비",
    scores: "악보관리",
    books: "찬양집관리",
    history: "찬양 이력",
    permissions: "권한 및 로그",
  };
  const pageTitle = $("#pageTitle");
  if (pageTitle) pageTitle.textContent = titles[viewId] || "이번 주 준비";
}

function render() {
  showApp(Boolean(state.user));
  if (!state.user) return;

  $("#currentUser").textContent = `${state.user.name} · ${state.user.permissions.label}`;
  $("#roleHint").textContent = state.user.permissions.hint;
  renderNavigation();
  renderRestrictedControls();
  renderHome();
  renderScores();
  renderBooks();
  renderHistory();
  renderPermissions();
}

function allowedViewsForRole(role) {
  if (role === "guest") return ["home"];
  if (role === "member") return ["home", "history"];
  if (role === "officer") return ["home", "scores", "books", "history", "permissions"];
  return ["home"];
}

function renderNavigation() {
  const allowed = allowedViewsForRole(state.user.role);
  $all(".nav-item").forEach((item) => {
    item.hidden = !allowed.includes(item.dataset.view);
  });
  const active = $(".view.active")?.id;
  if (!allowed.includes(active)) switchView("home");
}

function renderRestrictedControls() {
  $all(".restricted").forEach((element) => {
    const allowed = can(element.dataset.permission);
    element.classList.toggle("blocked", !allowed);
    element.toggleAttribute("disabled", !allowed && ["BUTTON", "SELECT"].includes(element.tagName));
    element.title = allowed ? "" : "현재 역할에는 권한이 없습니다.";
  });
}

function renderHome() {
  const isGuest = state.user.role === "guest";
  const canEditScores = can("manageScores");
  $("#homeEyebrow").textContent = isGuest ? "공개 찬양곡" : "이번 주 찬양곡";
  $("#homeHeading").textContent = isGuest ? "공개된 찬양곡 미리 보기" : "이번 주 / 다음 주 연습곡";
  $("#homeNotice").classList.toggle("hidden", !isGuest);
  $("#homeNotice").textContent = "타 찬양대원 권한에서는 공개된 곡 정보와 미리 보기 링크만 확인할 수 있습니다.";

  const currentScores = state.scores.filter((score) => (score.weekSlot || "current") === "current");
  const nextScores = state.scores.filter((score) => score.weekSlot === "next");
  $("#weeklyCardList").innerHTML = `
    ${renderWeeklyColumn("이번 주 곡", currentScores, isGuest, canEditScores)}
    ${renderWeeklyColumn("다음 주 곡", nextScores, isGuest, canEditScores)}
  `;
}

function renderWeeklyColumn(title, scores, isGuest, canEditScores) {
  return `
    <section class="weekly-column">
      <div class="weekly-column-head">
        <h3>${title}</h3>
        <span>${scores.length}곡</span>
      </div>
      <div class="weekly-column-list">
        ${
          scores
            .map(
              (score) => `
                <article class="weekly-card">
                  <div>
                    <h3>${escapeHtml(score.title)}</h3>
                    <div class="meta-row">
                      <span class="tag">${escapeHtml(score.service || "예배 미정")}</span>
                      <span class="tag">${escapeHtml(score.date)}</span>
                    </div>
                  </div>
                  <dl>
                    <dt>수록책</dt>
                    <dd>${escapeHtml(score.bookTitle || "미정")}</dd>
                    <dt>페이지</dt>
                    <dd>${escapeHtml(score.page || "미정")}</dd>
                  </dl>
                  <div class="item-actions">
                    ${score.preview ? `<a class="small-button" href="${escapeAttr(score.preview)}" target="_blank" rel="noreferrer">미리 보기</a>` : ""}
                    ${!isGuest && score.fileUrl ? `<a class="small-button" href="${escapeAttr(score.fileUrl)}" target="_blank" rel="noreferrer" data-download="${score.id}">악보 열기</a>` : ""}
                    ${canEditScores ? `<button class="small-button" data-edit-score="${score.id}">수정</button>` : ""}
                  </div>
                </article>
              `,
            )
            .join("") || emptyState(`${title}이 아직 없습니다.`)
        }
      </div>
    </section>
  `;
}

function renderScores() {
  const query = $("#scoreSearch").value.trim().toLowerCase();
  const part = $("#partFilter").value;
  const scores = state.scores.filter((score) => {
    const haystack = `${score.title} ${score.part} ${score.service}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!part || score.part === part);
  });

  $("#scoreList").innerHTML =
    scores
      .map(
        (score) => `
          <article class="item-card">
            <h3>${escapeHtml(score.title)}</h3>
            <p>${escapeHtml(score.date)} · ${escapeHtml(score.service || "예배 미정")}</p>
            <div class="meta-row">
              <span class="tag">${escapeHtml(score.bookTitle || "수록책 미정")}</span>
              <span class="tag">${escapeHtml(score.page ? `${score.page}쪽` : "페이지 미정")}</span>
              <span class="tag">${escapeHtml(score.part || "합창")}</span>
              <span class="tag">${escapeHtml(score.file || "파일 없음")}</span>
              <span class="tag">${escapeHtml(score.version || "버전 없음")}</span>
              <span class="tag">${accessLabel(score.access)}</span>
            </div>
            <div class="item-actions">
              ${score.preview ? `<a class="small-button" href="${escapeAttr(score.preview)}" target="_blank" rel="noreferrer">미리 보기</a>` : ""}
              ${score.fileUrl ? `<a class="small-button" href="${escapeAttr(score.fileUrl)}" target="_blank" rel="noreferrer" data-download="${score.id}">악보 열기</a>` : ""}
              <button class="small-button" data-download-log="${score.id}">다운로드 기록</button>
              <button class="small-button" data-edit-score="${score.id}">수정</button>
              <button class="small-button restricted ${can("manageScores") ? "" : "blocked"}" data-delete-score="${score.id}" data-permission="manageScores">삭제</button>
            </div>
          </article>
        `,
      )
      .join("") || emptyState("검색 결과가 없습니다.");
}

function renderBooks() {
  const query = $("#bookSearch").value.trim().toLowerCase();
  const books = state.books.filter((book) => {
    const haystack = `${book.code || ""} ${book.title} ${book.songs.map((song) => songTitle(song)).join(" ")}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  $("#bookList").innerHTML =
    books
      .map((book) => {
        const low = Number(book.stock) <= Number(book.threshold);
        return `
          <article class="item-card">
            <h3>${escapeHtml(book.title)}</h3>
            <p>구매 권수 ${book.stock}권</p>
            <div class="meta-row">
              ${low ? '<span class="tag warn">추가 구매 검토</span>' : '<span class="tag">보유 권수 충분</span>'}
              <span class="tag">경고 기준 ${book.threshold}권</span>
            </div>
            <p>${book.songs.map((song) => escapeHtml(songTitle(song))).join(" · ") || "등록된 수록곡 없음"}</p>
            <div class="item-actions">
              <label class="stock-editor restricted ${can("manageBooks") ? "" : "blocked"}" data-permission="manageBooks">
                <span>보유 권수</span>
                <input type="number" min="0" value="${Number(book.stock)}" data-stock-input="${bookKey(book)}" ${can("manageBooks") ? "" : "disabled"} />
              </label>
              <button class="small-button restricted ${can("manageBooks") ? "" : "blocked"}" data-save-stock="${bookKey(book)}" data-permission="manageBooks">저장</button>
              <button class="small-button restricted ${can("manageBooks") ? "" : "blocked"}" data-manage-book-songs="${bookKey(book)}" data-permission="manageBooks">수록곡 관리</button>
              <button class="small-button restricted ${can("manageBooks") ? "" : "blocked"}" data-delete-book="${bookKey(book)}" data-permission="manageBooks">삭제</button>
            </div>
          </article>
        `;
      })
      .join("") || emptyState("검색 결과가 없습니다.");
  renderBookDetailSelect();
  renderBookSongManager();
  renderBookMode();
}

function renderBookMode() {
  $all("[data-book-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.bookPanel !== bookMode);
  });
  $all("[data-book-mode]").forEach((button) => {
    if (!button.classList.contains("book-mode-tab")) return;
    button.classList.toggle("active", button.dataset.bookMode === bookMode);
  });
}

function switchBookMode(mode) {
  if (mode !== "list" && !can("manageBooks")) return showToast("현재 역할에는 찬양집 관리 권한이 없습니다.");
  bookMode = mode;
  if (bookMode === "detail" && !selectedBookId) selectedBookId = bookKey(state.books[0] || {});
  renderBookDetailSelect();
  renderBookSongManager();
  renderBookMode();
}

function renderBookDetailSelect() {
  const select = $("#bookDetailSelect");
  if (!select) return;
  if (!selectedBookId && state.books.length) selectedBookId = bookKey(state.books[0]);
  select.innerHTML = state.books.map((book) => `<option value="${escapeAttr(bookKey(book))}" ${bookKey(book) === selectedBookId ? "selected" : ""}>${escapeHtml(book.title)}</option>`).join("");
}

function renderBookSongManager() {
  const manager = $("#bookSongManager");
  const book = state.books.find((item) => bookKey(item) === selectedBookId);
  if (!book || !can("manageBooks")) {
    manager.innerHTML = "";
    return;
  }
  manager.innerHTML = `
    <section class="book-song-manager">
      <div class="book-song-manager-head">
        <div>
          <p class="eyebrow">찬양집 목차 관리</p>
          <h3>${escapeHtml(book.title)}</h3>
        </div>
        <button class="ghost-button" type="button" data-close-book-songs>닫기</button>
      </div>
      <div class="book-song-editor-grid">
        <label><span>순번</span><input id="bookSongSeq" placeholder="예: 1" /></label>
        <label><span>찬양명</span><input id="bookSongTitle" placeholder="예: 은혜 아니면" /></label>
        <label><span>페이지</span><input id="bookSongPage" placeholder="예: 64" /></label>
        <label><span>미리듣기</span><input id="bookSongPreview" type="url" placeholder="https://..." /></label>
        <button class="primary-button" type="button" data-add-book-song="${bookKey(book)}">수록곡 추가</button>
      </div>
      <div class="history-table-wrap book-song-table-wrap">
        <table class="history-table book-song-table">
          <thead>
            <tr>
              <th>순번</th>
              <th>찬양명</th>
              <th>페이지</th>
              <th>미리듣기</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            ${book.songs
              .map((song) => renderBookSongRow(book, normalizeClientSong(song)))
              .join("") || '<tr class="is-empty"><td colspan="5">등록된 수록곡이 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="form-actions">
        <button class="primary-button" type="button" data-save-book-songs="${bookKey(book)}">목차 저장</button>
      </div>
    </section>
  `;
}

function renderBookSongRow(book, song) {
  const code = bookKey(book);
  return `
    <tr>
      <td><input class="table-input" data-book-song-field="seq" data-book-code="${escapeAttr(code)}" data-original-seq="${escapeAttr(song.seq)}" value="${escapeAttr(song.seq)}" /></td>
      <td><input class="table-input" data-book-song-field="title" data-book-code="${escapeAttr(code)}" data-original-seq="${escapeAttr(song.seq)}" value="${escapeAttr(song.title)}" /></td>
      <td><input class="table-input" data-book-song-field="page" data-book-code="${escapeAttr(code)}" data-original-seq="${escapeAttr(song.seq)}" value="${escapeAttr(song.page)}" /></td>
      <td><input class="table-input" data-book-song-field="preview" data-book-code="${escapeAttr(code)}" data-original-seq="${escapeAttr(song.seq)}" value="${escapeAttr(song.preview)}" /></td>
      <td><button class="small-button" type="button" data-remove-book-song="${escapeAttr(code)}" data-seq="${escapeAttr(song.seq)}">삭제</button></td>
    </tr>
  `;
}

function renderHistory() {
  const query = historySearchQuery.trim().toLowerCase();
  const yearFilter = $("#historyYearFilter");
  const years = [...new Set(state.scores.map((score) => String(score.date || "").slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const selectedYear = yearFilter.value || years[0] || String(new Date().getFullYear());
  const yearOptions = years.includes(selectedYear) ? years : [selectedYear, ...years];
  yearFilter.innerHTML = yearOptions.map((year) => `<option value="${year}" ${year === selectedYear ? "selected" : ""}>${year}년</option>`).join("");

  const titleCounts = state.scores.reduce((acc, score) => {
    if (score.title) acc[score.title] = (acc[score.title] || 0) + 1;
    return acc;
  }, {});
  const scoresByDate = state.scores.reduce((acc, score) => {
    if (!score.date || !String(score.date).startsWith(selectedYear)) return acc;
    const haystack = `${score.title} ${score.date} ${score.service} ${resolveScoreBookTitle(score)}`.toLowerCase();
    if (query && !haystack.includes(query)) return acc;
    acc[score.date] = acc[score.date] || [];
    acc[score.date].push(score);
    return acc;
  }, {});
  const weeks = buildYearWeeks(selectedYear);
  const registeredCount = Object.values(scoresByDate).reduce((sum, scores) => sum + scores.length, 0);

  $("#historyStats").textContent = `${selectedYear}년 52주 기준 · 악보관리 등록 ${registeredCount}건`;
  $("#historyList").innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>일자</th>
          <th>찬양</th>
          <th>수록찬양집</th>
          <th>이력 횟수</th>
        </tr>
      </thead>
      <tbody>
        ${weeks
          .map((date) => {
            const scores = scoresByDate[date] || [];
            return `
              <tr class="${scores.length ? "" : "is-empty"}">
                <td>${escapeHtml(date)}</td>
                <td class="history-song">${scores.length ? scores.map((score) => renderHistorySongCell(score)).join("") : ""}</td>
                <td>${scores.length ? scores.map((score) => `<div>${escapeHtml(resolveScoreBookTitle(score))}</div>`).join("") : ""}</td>
                <td>${scores.length ? scores.map((score) => `<div>${titleCounts[score.title] || 1}회</div>`).join("") : ""}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
  $("#repeatStats").innerHTML = renderRepeatStats(selectedYear);
}

function renderHistorySongCell(score) {
  if (!can("manageScores")) return `<div>${escapeHtml(score.title)}</div>`;
  return `<button class="history-song-link" type="button" data-edit-score="${score.id}">${escapeHtml(score.title)}</button>`;
}

function resolveScoreBookTitle(score) {
  if (score.bookTitle) return score.bookTitle;
  const matchedBook = state.books.find((book) => book.songs.some((song) => normalizeText(songTitle(song)) === normalizeText(score.title)));
  return matchedBook?.title || "-";
}

function bookKey(book) {
  return book.code || book.id;
}

function normalizeClientSong(song) {
  if (typeof song === "string") return { seq: "", title: song, page: "", preview: "" };
  return {
    seq: String(song.seq || ""),
    title: String(song.title || ""),
    page: String(song.page || ""),
    preview: String(song.preview || ""),
  };
}

function songTitle(song) {
  return normalizeClientSong(song).title;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function renderRepeatStats(selectedYear) {
  const ranges = [
    { label: "최근 1년", years: 1 },
    { label: "최근 2년", years: 2 },
    { label: "최근 3년", years: 3 },
  ];
  const rows = ranges.flatMap((range) => buildRepeatRows(selectedYear, range));
  return `
    <section class="repeat-stats-panel">
      <div class="repeat-stats-head">
        <h3>반복 찬양 통계</h3>
        <span>각 기간 안에서 2회 이상 등록된 곡</span>
      </div>
      ${
        rows.length
          ? `
            <div class="history-table-wrap">
              <table class="history-table repeat-table">
                <thead>
                  <tr>
                    <th>기간</th>
                    <th>찬양</th>
                    <th>횟수</th>
                    <th>최근 찬양일</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map(
                      (row) => `
                        <tr>
                          <td>${row.label}</td>
                          <td class="history-song">${escapeHtml(row.title)}</td>
                          <td>${row.count}회</td>
                          <td>${escapeHtml(row.latestDate)}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : emptyState("최근 1년, 2년, 3년 기준으로 2회 이상 등록된 곡이 없습니다.")
      }
    </section>
  `;
}

function buildRepeatRows(selectedYear, range) {
  const end = new Date(Number(selectedYear), 11, 31);
  const start = new Date(end);
  start.setFullYear(end.getFullYear() - range.years);
  start.setDate(start.getDate() + 1);

  const grouped = state.scores.reduce((acc, score) => {
    if (!score.title || !score.date) return acc;
    const date = new Date(`${score.date}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date < start || date > end) return acc;
    acc[score.title] = acc[score.title] || [];
    acc[score.title].push(score.date);
    return acc;
  }, {});

  return Object.entries(grouped)
    .filter(([, dates]) => dates.length >= 2)
    .map(([title, dates]) => ({
      label: range.label,
      title,
      count: dates.length,
      latestDate: dates.sort().at(-1),
    }))
    .sort((a, b) => b.count - a.count || b.latestDate.localeCompare(a.latestDate) || a.title.localeCompare(b.title));
}

function renderPermissions() {
  renderPermissionMode();
  const roleOptions = Object.entries(state.permissions).map(([role, permission]) => `<option value="${role}">${permission.label}</option>`).join("");
  const newUserRole = $("#newUserRole");
  if (newUserRole) newUserRole.innerHTML = `<option value="">권한 선택</option>${roleOptions}`;

  $("#userRoleList").innerHTML =
    state.users
      .map(
        (user) => `
          <div class="user-role-row">
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <span>${escapeHtml(user.email)}</span>
            </div>
            <select class="restricted" data-user-role="${user.id}" data-permission="managePermissions" ${can("managePermissions") ? "" : "disabled"}>
              ${Object.entries(state.permissions).map(([role, permission]) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${permission.label}</option>`).join("")}
            </select>
          </div>
        `,
      )
      .join("") || emptyState("등록된 사용자가 없습니다.");

  const rows = [
    ["악보 등록/수정", "manageScores"],
    ["찬양집 재고 수정", "manageBooks"],
    ["찬양 이력 조회", "manageHistory"],
    ["권한 관리", "managePermissions"],
  ];
  $("#permissionMatrix").innerHTML = rows
    .map(([label, key]) => {
      const value = Object.keys(state.permissions).map((role) => `${state.permissions[role].label}: ${state.permissions[role][key] ? "허용" : "제한"}`).join(" · ");
      return `<div class="permission-row"><span>${label}</span><strong>${value}</strong></div>`;
    })
    .join("");
  $("#activityLog").innerHTML = renderLogs(state.logs);
}

function renderPermissionMode() {
  $all("[data-permission-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.permissionPanel !== permissionMode);
  });
  $all("[data-permission-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.permissionMode === permissionMode);
  });
}

function switchPermissionMode(mode) {
  permissionMode = mode;
  renderPermissionMode();
}

function renderLogs(logs) {
  return logs.map((log) => `<div class="log-line"><strong>${escapeHtml(log.actor)}</strong> · ${formatDate(log.at)}<br />${escapeHtml(log.action)}</div>`).join("") || emptyState("활동 로그가 없습니다.");
}

function accessLabel(access) {
  return { all: "전체 공개", leaders: "임원 전용", director: "임원 전용" }[access] || "전체 공개";
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function buildYearWeeks(year) {
  const start = new Date(Number(year), 0, 1);
  const daysUntilSunday = (7 - start.getDay()) % 7;
  start.setDate(start.getDate() + daysUntilSunday);
  return Array.from({ length: 52 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index * 7);
    return formatDateOnly(date);
  });
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function resetForm(form) {
  form.reset();
  delete form.dataset.editingScoreId;
  if (form.id === "scoreForm") form.classList.add("hidden");
}

function resetLoggedOutScreen() {
  state = { user: null, permissions: {}, scores: [], books: [], history: [], logs: [], users: [] };
  selectedBookId = "";
  bookMode = "list";
  permissionMode = "users";
  $all("form").forEach((form) => form.reset());
  $all("form").forEach((form) => delete form.dataset.editingScoreId);
  const scoreForm = $("#scoreForm");
  if (scoreForm) scoreForm.classList.add("hidden");
  ["weeklyCardList", "scoreList", "bookList", "historyList", "historyStats", "userRoleList", "permissionMatrix", "activityLog"].forEach((id) => {
    const element = $(`#${id}`);
    if (element) element.innerHTML = "";
  });
  ["scoreSearch", "bookSearch", "historySearch"].forEach((id) => {
    const element = $(`#${id}`);
    if (element) element.value = "";
  });
  historySearchQuery = "";
  const partFilter = $("#partFilter");
  if (partFilter) partFilter.value = "";
  const historyYearFilter = $("#historyYearFilter");
  if (historyYearFilter) historyYearFilter.innerHTML = "";
  switchView("home");
  render();
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function exportBooksCsv() {
  const header = "찬양집명,구매권수,경고기준,수록곡";
  const rows = state.books.map((book) =>
    [book.title, book.stock, book.threshold, book.songs.map((song) => `${normalizeClientSong(song).seq}:${normalizeClientSong(song).title}`).join("|")]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "찬양집목록.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function openScoreEditor(scoreId) {
  const score = state.scores.find((item) => item.id === scoreId);
  if (!score || !can("manageScores")) return;
  const form = $("#scoreForm");
  form.dataset.editingScoreId = score.id;
  form.classList.remove("hidden");
  form.elements.title.value = score.title || "";
  form.elements.date.value = score.date || "";
  form.elements.service.value = score.service || "";
  form.elements.weekSlot.value = score.weekSlot || "current";
  form.elements.bookTitle.value = score.bookTitle || "";
  form.elements.page.value = score.page || "";
  form.elements.part.value = score.part || "합창";
  form.elements.version.value = score.version || "";
  form.elements.preview.value = score.preview || "";
  form.elements.access.value = score.access === "director" ? "leaders" : score.access || "all";
  if (form.elements.scoreFile) form.elements.scoreFile.value = "";
  switchView("scores");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshAfter(message) {
  pulseSync();
  await loadState();
  if (message) showToast(message);
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  try {
    const navItem = target.closest("[data-view]");
    if (navItem) switchView(navItem.dataset.view);

    const editScoreId = target.dataset.editScore;
    if (editScoreId) openScoreEditor(editScoreId);

    const nextBookMode = target.dataset.bookMode;
    if (nextBookMode) switchBookMode(nextBookMode);

    const nextPermissionMode = target.dataset.permissionMode;
    if (nextPermissionMode) switchPermissionMode(nextPermissionMode);

    if (target.id === "addScoreButton" && can("manageScores")) {
      resetForm($("#scoreForm"));
      $("#scoreForm").classList.remove("hidden");
    }
    if (target.dataset.cancel) resetForm($(`#${target.dataset.cancel}`));

    const downloadLogId = target.dataset.downloadLog || target.dataset.download;
    if (downloadLogId) {
      await api(`/api/download-log/${downloadLogId}`, { method: "POST" });
      await refreshAfter("다운로드 활동을 기록했습니다.");
    }

    const saveStockId = target.dataset.saveStock;
    if (saveStockId && can("manageBooks")) {
      const input = $all("[data-stock-input]").find((element) => element.dataset.stockInput === saveStockId);
      const book = state.books.find((item) => item.id === saveStockId);
      const nextStock = Math.max(0, Number(input.value || 0));
      await api(`/api/books/${saveStockId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: nextStock, delta: nextStock - Number(book?.stock || 0) }),
      });
      await refreshAfter();
    }

    const deleteScoreId = target.dataset.deleteScore;
    if (deleteScoreId && can("manageScores")) {
      await api(`/api/scores/${deleteScoreId}`, { method: "DELETE" });
      await refreshAfter();
    }

    const deleteBookId = target.dataset.deleteBook;
    if (deleteBookId && can("manageBooks")) {
      await api(`/api/books/${deleteBookId}`, { method: "DELETE" });
      await refreshAfter();
    }

    if (target.id === "exportBooks" && can("manageBooks")) exportBooksCsv();

    const manageBookSongsId = target.dataset.manageBookSongs;
    if (manageBookSongsId && can("manageBooks")) {
      selectedBookId = manageBookSongsId;
      switchBookMode("detail");
      $("#bookSongManager").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (target.dataset.closeBookSongs !== undefined) {
      selectedBookId = "";
      renderBookSongManager();
    }

    const addBookSongCode = target.dataset.addBookSong;
    if (addBookSongCode && can("manageBooks")) {
      const book = state.books.find((item) => bookKey(item) === addBookSongCode);
      const song = {
        seq: $("#bookSongSeq").value.trim(),
        title: $("#bookSongTitle").value.trim(),
        page: $("#bookSongPage").value.trim(),
        preview: $("#bookSongPreview").value.trim(),
      };
      if (!song.seq || !song.title) return showToast("순번과 찬양명을 입력해주세요.");
      if (book.songs.some((item) => normalizeClientSong(item).seq === song.seq)) return showToast("이미 같은 순번이 있습니다.");
      book.songs.push(song);
      book.songs.sort((a, b) => normalizeClientSong(a).seq.localeCompare(normalizeClientSong(b).seq, "ko", { numeric: true }));
      renderBookSongManager();
    }

    const removeBookSongCode = target.dataset.removeBookSong;
    if (removeBookSongCode && can("manageBooks")) {
      const book = state.books.find((item) => bookKey(item) === removeBookSongCode);
      book.songs = book.songs.filter((song) => normalizeClientSong(song).seq !== target.dataset.seq);
      renderBookSongManager();
    }

    const saveBookSongsId = target.dataset.saveBookSongs;
    if (saveBookSongsId && can("manageBooks")) {
      const rows = {};
      $all("[data-book-code]").filter((input) => input.dataset.bookCode === saveBookSongsId).forEach((input) => {
        const seq = input.dataset.originalSeq;
        rows[seq] = rows[seq] || {};
        rows[seq][input.dataset.bookSongField] = input.value.trim();
      });
      const songs = Object.values(rows).filter((song) => song.seq && song.title);
      await api(`/api/books/${saveBookSongsId}/songs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs }),
      });
      await refreshAfter("찬양집 목차가 저장되었습니다.");
    }

    if (target.id === "historySearchButton") {
      historySearchQuery = $("#historySearch").value;
      renderHistory();
    }

    if (target.id === "resetDemo" && can("managePermissions")) {
      await api("/api/reset-demo", { method: "POST" });
      await refreshAfter("데모 데이터가 초기화되었습니다.");
    }

    if (target.id === "logoutButton") {
      await api("/api/logout", { method: "POST" });
      resetLoggedOutScreen();
    }
  } catch (error) {
    alert(error.message);
  }
});

document.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.id === "bookDetailSelect") {
    selectedBookId = target.value;
    renderBookSongManager();
    return;
  }
  const userId = target.dataset.userRole;
  if (!userId) return;
  try {
    await api(`/api/users/${userId}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: target.value }) });
    await refreshAfter("사용자 역할이 변경되었습니다.");
  } catch (error) {
    showToast(error.message);
    await loadState();
  }
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData(form)) });
    await loadState();
    showToast("로그인되었습니다.");
  } catch (error) {
    alert(error.message);
  }
});

$("#scoreForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!can("manageScores")) return showToast("현재 역할에는 악보 등록 권한이 없습니다.");
  const form = event.currentTarget;
  try {
    const editingScoreId = form.dataset.editingScoreId;
    await api(editingScoreId ? `/api/scores/${editingScoreId}` : "/api/scores", { method: editingScoreId ? "PATCH" : "POST", body: new FormData(form) });
    resetForm(form);
    await refreshAfter(editingScoreId ? "찬양곡 정보가 수정되었습니다." : "찬양곡과 악보 파일이 저장되었습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#bookForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!can("manageBooks")) return showToast("현재 역할에는 찬양집 관리 권한이 없습니다.");
  const form = event.currentTarget;
  try {
    await api("/api/books", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData(form)) });
    form.reset();
    bookMode = "list";
    await refreshAfter("찬양집이 저장되었습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#userForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!can("managePermissions")) return showToast("현재 역할에는 사용자 등록 권한이 없습니다.");
  const form = event.currentTarget;
  try {
    await api("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData(form)),
    });
    form.reset();
    await refreshAfter("사용자가 등록되었습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#roleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!can("managePermissions")) return showToast("현재 역할에는 권한 등록 권한이 없습니다.");
  const form = event.currentTarget;
  const data = formData(form);
  try {
    await api("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        manageScores: Boolean(data.manageScores),
        manageBooks: Boolean(data.manageBooks),
        manageHistory: Boolean(data.manageHistory),
        managePermissions: Boolean(data.managePermissions),
      }),
    });
    form.reset();
    await refreshAfter("권한이 등록되었습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

["scoreSearch", "partFilter", "bookSearch", "historyYearFilter"].forEach((id) => {
  const element = $(`#${id}`);
  if (element) {
    element.addEventListener("input", render);
    element.addEventListener("change", render);
  }
});

const historySearchInput = $("#historySearch");
if (historySearchInput) {
  historySearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    historySearchQuery = event.currentTarget.value;
    renderHistory();
  });
}

async function boot() {
  try {
    await loadState();
  } catch {
    resetLoggedOutScreen();
  }
}

boot();

