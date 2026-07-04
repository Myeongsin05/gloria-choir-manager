let state = {
  user: null,
  permissions: {},
  scores: [],
  books: [],
  history: [],
  logs: [],
  users: [],
};

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
  if (!response.ok) {
    throw new Error(payload?.error || "요청을 처리하지 못했습니다.");
  }
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
  sync.textContent = text;
  window.setTimeout(() => {
    sync.textContent = "서버 동기화 완료";
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
    scores: "악보 관리",
    books: "찬양집 관리",
    history: "찬양 이력",
    permissions: "권한 및 로그",
  };
  $("#pageTitle").textContent = titles[viewId] || "이번 주 악보";
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

function renderNavigation() {
  const allowed = allowedViewsForRole(state.user.role);
  $all(".nav-item").forEach((item) => {
    item.hidden = !allowed.includes(item.dataset.view);
  });
  const active = $(".view.active")?.id;
  if (!allowed.includes(active)) switchView("home");
}

function allowedViewsForRole(role) {
  if (role === "guest") return ["home"];
  if (role === "member") return ["home", "scores", "books", "history"];
  if (role === "officer") return ["home", "scores", "books", "history"];
  return ["home", "scores", "books", "history", "permissions"];
}

function renderRestrictedControls() {
  $all(".restricted").forEach((element) => {
    const allowed = can(element.dataset.permission);
    element.classList.toggle("blocked", !allowed);
    element.title = allowed ? "" : "현재 역할에는 권한이 없습니다.";
  });
}

function renderHome() {
  const isGuest = state.user.role === "guest";
  $("#homeEyebrow").textContent = isGuest ? "공개 찬양곡" : "이번 주 찬양곡";
  $("#homeHeading").textContent = isGuest ? "공개된 찬양곡 미리 보기" : "이번 주 / 다음 주 연습곡";
  $("#homeNotice").classList.toggle("hidden", !isGuest);
  $("#homeNotice").textContent = "타 찬양대원 권한에서는 전체 악보 관리 메뉴 없이 공개된 곡 정보와 미리 보기 링크만 확인할 수 있습니다.";

  const currentScores = state.scores.filter((score) => (score.weekSlot || "current") === "current");
  const nextScores = state.scores.filter((score) => score.weekSlot === "next");

  $("#weeklyCardList").innerHTML = `
    ${renderWeeklyColumn("이번 주 곡", currentScores, isGuest)}
    ${renderWeeklyColumn("다음 주 곡", nextScores, isGuest)}
  `;
}

function renderWeeklyColumn(title, scores, isGuest) {
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
                <span class="tag">${escapeHtml(score.service || "예배 미지정")}</span>
                <span class="tag">${escapeHtml(score.date)}</span>
              </div>
            </div>
            <dl>
              <dt>수록책</dt>
              <dd>${escapeHtml(score.bookTitle || "미지정")}</dd>
              <dt>페이지</dt>
              <dd>${escapeHtml(score.page || "미지정")}</dd>
            </dl>
            <div class="item-actions">
              ${score.preview ? `<a class="small-button" href="${escapeAttr(score.preview)}" target="_blank" rel="noreferrer">미리 보기</a>` : ""}
              ${!isGuest && score.fileUrl ? `<a class="small-button" href="${escapeAttr(score.fileUrl)}" target="_blank" rel="noreferrer" data-download="${score.id}">악보 열기</a>` : ""}
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
            <p>${escapeHtml(score.date)} · ${escapeHtml(score.service || "예배 미지정")}</p>
            <div class="meta-row">
              <span class="tag">${escapeHtml(score.bookTitle || "수록책 미지정")}</span>
              <span class="tag">${escapeHtml(score.page ? `${score.page}쪽` : "페이지 미지정")}</span>
              <span class="tag">${escapeHtml(score.part)}</span>
              <span class="tag">${escapeHtml(score.file || "파일 없음")}</span>
              <span class="tag">${escapeHtml(score.version || "버전 없음")}</span>
              <span class="tag">${accessLabel(score.access)}</span>
            </div>
            <div class="item-actions">
              ${score.preview ? `<a class="small-button" href="${escapeAttr(score.preview)}" target="_blank" rel="noreferrer">미리 듣기</a>` : ""}
              ${score.fileUrl ? `<a class="small-button" href="${escapeAttr(score.fileUrl)}" target="_blank" rel="noreferrer" data-download="${score.id}">악보 열기</a>` : ""}
              <button class="small-button" data-download-log="${score.id}">다운로드 기록</button>
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
    const haystack = `${book.title} ${book.songs.join(" ")}`.toLowerCase();
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
            <p>${book.songs.map(escapeHtml).join(" · ")}</p>
            <div class="item-actions">
              <button class="small-button restricted ${can("manageBooks") ? "" : "blocked"}" data-stock="${book.id}" data-delta="1" data-permission="manageBooks">+1</button>
              <button class="small-button restricted ${can("manageBooks") ? "" : "blocked"}" data-stock="${book.id}" data-delta="-1" data-permission="manageBooks">-1</button>
              <button class="small-button restricted ${can("manageBooks") ? "" : "blocked"}" data-delete-book="${book.id}" data-permission="manageBooks">삭제</button>
            </div>
          </article>
        `;
      })
      .join("") || emptyState("검색 결과가 없습니다.");
}

function renderHistory() {
  const query = $("#historySearch").value.trim().toLowerCase();
  const rows = state.history.filter((row) => {
    const haystack = `${row.title} ${row.date} ${row.service}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  $("#historyList").innerHTML =
    rows
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(
        (row) => `
          <article class="item-card">
            <h3>${escapeHtml(row.title)}</h3>
            <p>${escapeHtml(row.date)} · ${escapeHtml(row.service || "예배 미지정")}</p>
            <div class="item-actions">
              ${row.media ? `<a class="small-button" href="${escapeAttr(row.media)}" target="_blank" rel="noreferrer">첨부 보기</a>` : ""}
              <button class="small-button restricted ${can("manageHistory") ? "" : "blocked"}" data-delete-history="${row.id}" data-permission="manageHistory">삭제</button>
            </div>
          </article>
        `,
      )
      .join("") || emptyState("이력 검색 결과가 없습니다.");

  const frequency = state.history.reduce((acc, row) => {
    acc[row.title] = (acc[row.title] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
  $("#historyStats").innerHTML =
    top
      .map(([title, count]) => `<div class="stat-row"><span>${escapeHtml(title)}</span><strong>${count}회</strong></div>`)
      .join("") || emptyState("통계를 만들 이력이 없습니다.");
}

function renderPermissions() {
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
              ${Object.entries(state.permissions)
                .map(([role, permission]) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${permission.label}</option>`)
                .join("")}
            </select>
          </div>
        `,
      )
      .join("") || emptyState("등록된 사용자가 없습니다.");

  const rows = [
    ["악보 등록/수정", "manageScores"],
    ["찬양집 재고 수정", "manageBooks"],
    ["찬양 이력 등록", "manageHistory"],
    ["권한 관리", "managePermissions"],
  ];
  $("#permissionMatrix").innerHTML = rows
    .map(([label, key]) => {
      const value = Object.keys(state.permissions)
        .map((role) => `${state.permissions[role].label}: ${state.permissions[role][key] ? "허용" : "제한"}`)
        .join(" · ");
      return `<div class="permission-row"><span>${label}</span><strong>${value}</strong></div>`;
    })
    .join("");
  $("#activityLog").innerHTML = renderLogs(state.logs);
}

function renderLogs(logs) {
  return (
    logs
      .map((log) => `<div class="log-line"><strong>${escapeHtml(log.actor)}</strong> · ${formatDate(log.at)}<br />${escapeHtml(log.action)}</div>`)
      .join("") || emptyState("활동 로그가 없습니다.")
  );
}

function accessLabel(access) {
  return {
    all: "전체 공개",
    leaders: "지휘자/임원",
    director: "지휘자 전용",
  }[access] || "전체 공개";
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function resetForm(form) {
  form.reset();
  form.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function exportBooksCsv() {
  const header = "찬양집명,구매권수,경고기준,수록곡";
  const rows = state.books.map((book) =>
    [book.title, book.stock, book.threshold, book.songs.join("|")]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "choir-books.csv";
  anchor.click();
  URL.revokeObjectURL(url);
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

    const jump = target.closest("[data-jump]");
    if (jump) switchView(jump.dataset.jump);

    if (target.id === "addScoreButton" && can("manageScores")) $("#scoreForm").classList.remove("hidden");
    if (target.id === "addBookButton" && can("manageBooks")) $("#bookForm").classList.remove("hidden");
    if (target.id === "addHistoryButton" && can("manageHistory")) $("#historyForm").classList.remove("hidden");
    if (target.dataset.cancel) resetForm($(`#${target.dataset.cancel}`));

    const downloadLogId = target.dataset.downloadLog || target.dataset.download;
    if (downloadLogId) {
      await api(`/api/download-log/${downloadLogId}`, { method: "POST" });
      await refreshAfter("다운로드 활동이 기록되었습니다.");
    }

    const stockId = target.dataset.stock;
    if (stockId && can("manageBooks")) {
      await api(`/api/books/${stockId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: Number(target.dataset.delta) }),
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

    const deleteHistoryId = target.dataset.deleteHistory;
    if (deleteHistoryId && can("manageHistory")) {
      await api(`/api/history/${deleteHistoryId}`, { method: "DELETE" });
      await refreshAfter();
    }

    if (target.id === "exportBooks" && can("manageBooks")) exportBooksCsv();

    if (target.id === "resetDemo" && can("managePermissions")) {
      await api("/api/reset-demo", { method: "POST" });
      await refreshAfter("데모 데이터가 초기화되었습니다.");
    }

    if (target.id === "logoutButton") {
      await api("/api/logout", { method: "POST" });
      state.user = null;
      render();
    }
  } catch (error) {
    alert(error.message);
  }
});

document.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const userId = target.dataset.userRole;
  if (!userId) return;
  try {
    await api(`/api/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: target.value }),
    });
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
    const data = formData(form);
    await api("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
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
    await api("/api/scores", {
      method: "POST",
      body: new FormData(form),
    });
    resetForm(form);
    await refreshAfter("찬양곡과 악보 파일이 저장되었습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#bookForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!can("manageBooks")) return showToast("현재 역할에는 찬양집 관리 권한이 없습니다.");
  const form = event.currentTarget;
  try {
    await api("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData(form)),
    });
    resetForm(form);
    await refreshAfter("찬양집이 저장되었습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#historyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!can("manageHistory")) return showToast("현재 역할에는 이력 등록 권한이 없습니다.");
  const form = event.currentTarget;
  try {
    await api("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData(form)),
    });
    resetForm(form);
    await refreshAfter("찬양 이력이 저장되었습니다.");
  } catch (error) {
    showToast(error.message);
  }
});

["scoreSearch", "partFilter", "bookSearch", "historySearch"].forEach((id) => {
  $(`#${id}`).addEventListener("input", render);
});

async function boot() {
  try {
    await loadState();
  } catch {
    state.user = null;
    render();
  }
}

boot();
