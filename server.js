const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const RUNTIME_ROOT = process.env.VERCEL ? path.join("/tmp", "choir-asset-system") : ROOT;
const DATA_DIR = path.join(RUNTIME_ROOT, "data");
const UPLOAD_DIR = path.join(RUNTIME_ROOT, "uploads");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const OUTBOX_PATH = path.join(DATA_DIR, "mail-outbox.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const permissions = {
  director: {
    label: "지휘자",
    hint: "모든 관리 기능을 사용할 수 있습니다.",
    manageScores: true,
    manageBooks: true,
    manageHistory: true,
    managePermissions: true,
  },
  officer: {
    label: "임원",
    hint: "악보, 찬양집, 이력 관리를 사용할 수 있습니다.",
    manageScores: true,
    manageBooks: true,
    manageHistory: true,
    managePermissions: false,
  },
  member: {
    label: "우리 찬양대원",
    hint: "이번 주 찬양곡과 공개된 악보, 미리 듣기를 확인할 수 있습니다.",
    manageScores: false,
    manageBooks: false,
    manageHistory: false,
    managePermissions: false,
  },
  guest: {
    label: "타 찬양대원",
    hint: "공개된 찬양곡의 기본 정보와 미리 보기만 확인할 수 있습니다.",
    manageScores: false,
    manageBooks: false,
    manageHistory: false,
    managePermissions: false,
  },
};

const defaultUsers = [
  { id: "u-director", name: "김지휘", email: "director@choir.local", password: "choir1234", role: "director" },
  { id: "u-officer", name: "김선교", email: "officer@choir.local", password: "choir1234", role: "officer" },
  { id: "u-member", name: "박대원", email: "member@choir.local", password: "choir1234", role: "member" },
  { id: "u-guest", name: "이방문", email: "guest@choir.local", password: "choir1234", role: "guest" },
];

const demoStore = {
  scores: [
    {
      id: "score-001",
      title: "주 하나님 지으신 모든 세계",
      date: "2026-07-05",
      service: "주일 2부 예배",
      weekSlot: "current",
      bookTitle: "중앙성가 42집",
      page: "128",
      part: "합창",
      file: "how-great-thou-art-v2.pdf",
      fileUrl: "",
      version: "v2.0",
      preview: "https://www.youtube.com/watch?v=Cc0QVWzCv9k",
      access: "all",
    },
    {
      id: "score-002",
      title: "은혜 아니면",
      date: "2026-07-12",
      service: "주일 오후 찬양",
      weekSlot: "next",
      bookTitle: "새찬송가 합창 편곡집",
      page: "64",
      part: "앙상블",
      file: "grace-ensemble.pdf",
      fileUrl: "",
      version: "v1.1",
      preview: "https://www.youtube.com/",
      access: "all",
    },
  ],
  books: [
    {
      id: "book-001",
      title: "중앙성가 42집",
      stock: 18,
      threshold: 5,
      songs: ["은혜", "주 사랑이 나를 숨쉬게 해", "기뻐하며 왕께"],
    },
    {
      id: "book-002",
      title: "새찬송가 합창 편곡집",
      stock: 4,
      threshold: 5,
      songs: ["내 주를 가까이", "샘물과 같은 보혈", "참 아름다워라"],
    },
  ],
  history: [
    {
      id: "history-001",
      title: "은혜 아니면",
      date: "2026-06-28",
      service: "주일 2부 예배",
      media: "https://www.youtube.com/",
    },
    {
      id: "history-002",
      title: "주 하나님 지으신 모든 세계",
      date: "2026-06-21",
      service: "주일 3부 예배",
      media: "",
    },
  ],
  logs: [
    {
      id: "log-001",
      at: new Date().toISOString(),
      actor: "시스템",
      action: "로컬 서버 데모 데이터가 준비되었습니다.",
    },
  ],
};

const sessions = new Map();

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) writeJson(filePath, fallback);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function readStore() {
  return readJson(STORE_PATH, demoStore);
}

function writeStore(store) {
  writeJson(STORE_PATH, store);
}

function readUsers() {
  return readJson(USERS_PATH, defaultUsers);
}

function writeUsers(users) {
  writeJson(USERS_PATH, users);
}

function readOutbox() {
  return readJson(OUTBOX_PATH, []);
}

function writeOutbox(messages) {
  writeJson(OUTBOX_PATH, messages);
}

function addLog(store, user, action) {
  store.logs.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: user ? `${user.name} ${permissions[user.role].label}` : "시스템",
    action,
  });
  store.logs = store.logs.slice(0, 80);
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: permissions[user.role],
  };
}

function requireAuth(req, res, next) {
  const sid = parseCookies(req).sid;
  const userId = sid && sessions.get(sid);
  const user = readUsers().find((item) => item.id === userId);
  if (!user) return res.status(401).json({ error: "로그인이 필요합니다." });
  req.user = user;
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!permissions[req.user.role][permission]) {
      return res.status(403).json({ error: "현재 역할에는 권한이 없습니다." });
    }
    next();
  };
}

function canAccessScore(user, score) {
  if (user.role === "guest") return score.access === "all";
  if (score.access === "leaders") return user.role === "director" || user.role === "officer";
  if (score.access === "director") return user.role === "director";
  return true;
}

function createTemporaryPassword() {
  return `choir-${crypto.randomBytes(3).toString("hex")}`;
}

function recordPasswordMail(user, temporaryPassword) {
  const outbox = readOutbox();
  outbox.unshift({
    id: crypto.randomUUID(),
    to: user.email,
    subject: "[찬양대 자산실] 임시 비밀번호 안내",
    temporaryPassword,
    body: `${user.name}님, 임시 비밀번호는 ${temporaryPassword} 입니다. 로그인 후 비밀번호를 변경해 주세요.`,
    at: new Date().toISOString(),
    delivery: "local-outbox",
  });
  writeOutbox(outbox.slice(0, 50));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeBase = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9가-힣_-]/g, "_")
      .slice(0, 80);
    cb(null, `${Date.now()}-${safeBase}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const app = express();
app.use(express.json());
app.use("/uploads", requireAuth, express.static(UPLOAD_DIR));
app.use(express.static(ROOT));

app.post("/api/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = readUsers().find((item) => item.email.toLowerCase() === email);
  if (!user) {
    return res.status(401).json({
      code: "LOGIN_EMAIL_NOT_FOUND",
      error: "등록되지 않은 아이디입니다.",
    });
  }
  if (user.password !== password) {
    return res.status(401).json({
      code: "LOGIN_PASSWORD_MISMATCH",
      error: "비밀번호가 일치하지 않습니다.",
    });
  }
  const sid = crypto.randomUUID();
  sessions.set(sid, user.id);
  res.setHeader("Set-Cookie", `sid=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
  const store = readStore();
  addLog(store, user, "로그인했습니다.");
  writeStore(store);
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const sid = parseCookies(req).sid;
  sessions.delete(sid);
  res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.post("/api/password-reset", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const users = readUsers();
  const user = users.find((item) => item.email.toLowerCase() === email);
  if (!user) return res.status(404).json({ error: "등록된 이메일을 찾을 수 없습니다." });

  const temporaryPassword = createTemporaryPassword();
  user.password = temporaryPassword;
  writeUsers(users);
  recordPasswordMail(user, temporaryPassword);

  const store = readStore();
  addLog(store, user, "임시 비밀번호를 요청했습니다.");
  writeStore(store);

  res.json({
    ok: true,
    message: "임시 비밀번호를 등록된 이메일로 전송했습니다.",
    delivery: "local-outbox",
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), permissions });
});

app.get("/api/state", requireAuth, (req, res) => {
  const store = readStore();
  res.json({
    user: publicUser(req.user),
    permissions,
    users: readUsers().map(publicUser),
    scores: store.scores.filter((score) => canAccessScore(req.user, score)),
    books: store.books,
    history: store.history,
    logs: store.logs,
  });
});

app.patch("/api/users/:id/role", requireAuth, requirePermission("managePermissions"), (req, res) => {
  const nextRole = req.body.role;
  if (!permissions[nextRole]) return res.status(400).json({ error: "알 수 없는 역할입니다." });
  const users = readUsers();
  const target = users.find((item) => item.id === req.params.id);
  if (!target) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
  target.role = nextRole;
  writeUsers(users);
  const store = readStore();
  addLog(store, req.user, `${target.name} 사용자의 역할을 ${permissions[nextRole].label}(으)로 변경했습니다.`);
  writeStore(store);
  res.json({ user: publicUser(target) });
});

app.post("/api/scores", requireAuth, requirePermission("manageScores"), upload.single("scoreFile"), (req, res) => {
  const store = readStore();
  const score = {
    id: crypto.randomUUID(),
    title: req.body.title,
    date: req.body.date,
    service: req.body.service || "",
    weekSlot: req.body.weekSlot || "current",
    bookTitle: req.body.bookTitle || "",
    page: req.body.page || "",
    part: req.body.part || "합창",
    file: req.file ? req.file.originalname : req.body.file || "",
    fileUrl: req.file ? `/uploads/${req.file.filename}` : "",
    version: req.body.version || "v1.0",
    preview: req.body.preview || "",
    access: req.body.access || "all",
  };
  store.scores.unshift(score);
  addLog(store, req.user, `찬양곡 "${score.title}"을 등록했습니다.`);
  writeStore(store);
  res.status(201).json(score);
});

app.delete("/api/scores/:id", requireAuth, requirePermission("manageScores"), (req, res) => {
  const store = readStore();
  const score = store.scores.find((item) => item.id === req.params.id);
  store.scores = store.scores.filter((item) => item.id !== req.params.id);
  if (score) addLog(store, req.user, `찬양곡 "${score.title}" 항목을 삭제했습니다.`);
  writeStore(store);
  res.json({ ok: true });
});

app.post("/api/download-log/:id", requireAuth, (req, res) => {
  const store = readStore();
  const score = store.scores.find((item) => item.id === req.params.id);
  if (!score || !canAccessScore(req.user, score)) return res.status(404).json({ error: "악보를 찾을 수 없습니다." });
  addLog(store, req.user, `악보 "${score.title}" 다운로드를 기록했습니다.`);
  writeStore(store);
  res.json({ ok: true });
});

app.post("/api/books", requireAuth, requirePermission("manageBooks"), (req, res) => {
  const store = readStore();
  const book = {
    id: crypto.randomUUID(),
    title: req.body.title,
    stock: Number(req.body.stock || 0),
    threshold: Number(req.body.threshold || 0),
    songs: String(req.body.songs || "")
      .split(",")
      .map((song) => song.trim())
      .filter(Boolean),
  };
  store.books.unshift(book);
  addLog(store, req.user, `찬양집 "${book.title}"을 등록했습니다.`);
  writeStore(store);
  res.status(201).json(book);
});

app.patch("/api/books/:id/stock", requireAuth, requirePermission("manageBooks"), (req, res) => {
  const store = readStore();
  const book = store.books.find((item) => item.id === req.params.id);
  if (!book) return res.status(404).json({ error: "찬양집을 찾을 수 없습니다." });
  book.stock = Math.max(0, Number(book.stock) + Number(req.body.delta || 0));
  addLog(store, req.user, `"${book.title}" 재고를 ${book.stock}권으로 수정했습니다.`);
  writeStore(store);
  res.json(book);
});

app.delete("/api/books/:id", requireAuth, requirePermission("manageBooks"), (req, res) => {
  const store = readStore();
  const book = store.books.find((item) => item.id === req.params.id);
  store.books = store.books.filter((item) => item.id !== req.params.id);
  if (book) addLog(store, req.user, `찬양집 "${book.title}" 항목을 삭제했습니다.`);
  writeStore(store);
  res.json({ ok: true });
});

app.post("/api/history", requireAuth, requirePermission("manageHistory"), (req, res) => {
  const store = readStore();
  const row = {
    id: crypto.randomUUID(),
    title: req.body.title,
    date: req.body.date,
    service: req.body.service || "",
    media: req.body.media || "",
  };
  store.history.unshift(row);
  addLog(store, req.user, `찬양 이력 "${row.title}"을 등록했습니다.`);
  writeStore(store);
  res.status(201).json(row);
});

app.delete("/api/history/:id", requireAuth, requirePermission("manageHistory"), (req, res) => {
  const store = readStore();
  const row = store.history.find((item) => item.id === req.params.id);
  store.history = store.history.filter((item) => item.id !== req.params.id);
  if (row) addLog(store, req.user, `찬양 이력 "${row.title}" 항목을 삭제했습니다.`);
  writeStore(store);
  res.json({ ok: true });
});

app.post("/api/reset-demo", requireAuth, requirePermission("managePermissions"), (req, res) => {
  writeStore(demoStore);
  writeUsers(defaultUsers);
  writeOutbox([]);
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Choir asset system running at http://localhost:${PORT}`);
  });
}

module.exports = app;
