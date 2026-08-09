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
const PERMISSIONS_PATH = path.join(DATA_DIR, "permissions.json");
const OUTBOX_PATH = path.join(DATA_DIR, "mail-outbox.json");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "score-files";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const SESSION_SECRET = process.env.SESSION_SECRET || SUPABASE_SERVICE_ROLE_KEY || "local-dev-session-secret";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const defaultPermissions = {
  officer: {
    label: "임원",
    hint: "악보관리와 찬양집관리, 권한 관리 기능을 사용할 수 있습니다.",
    manageScores: true,
    manageBooks: true,
    manageHistory: true,
    managePermissions: true,
  },
  member: {
    label: "우리 찬양대원",
    hint: "이번 주와 다음 주 찬양곡 정보를 확인할 수 있습니다.",
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
  { id: "u-officer", name: "김임원", email: "officer@choir.local", password: "choir1234", role: "officer" },
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
      bookTitle: "새찬양 합창곡집",
      page: "64",
      part: "혼성4부",
      file: "grace-ensemble.pdf",
      fileUrl: "",
      version: "v1.1",
      preview: "https://www.youtube.com/",
      access: "all",
    },
  ],
  books: [
    {
      code: "JASG-42",
      title: "중앙성가 42집",
      stock: 18,
      threshold: 5,
      songs: [
        { seq: "001", title: "주 하나님 지으신 모든 세계", page: "128", preview: "https://www.youtube.com/watch?v=Cc0QVWzCv9k" },
        { seq: "002", title: "주의 사랑", page: "", preview: "" },
        { seq: "003", title: "기뻐하며 찬양", page: "", preview: "" },
      ],
    },
    {
      code: "NEW-CHOIR",
      title: "새찬양 합창곡집",
      stock: 4,
      threshold: 5,
      songs: [
        { seq: "001", title: "은혜 아니면", page: "64", preview: "https://www.youtube.com/" },
        { seq: "002", title: "내 주를 가까이", page: "", preview: "" },
        { seq: "003", title: "참 아름다워라", page: "", preview: "" },
      ],
    },
  ],
  history: [
    { id: "history-001", title: "은혜 아니면", date: "2026-06-28", service: "주일 2부 예배", media: "https://www.youtube.com/" },
    { id: "history-002", title: "주 하나님 지으신 모든 세계", date: "2026-06-21", service: "주일 3부 예배", media: "" },
  ],
  logs: [{ id: "log-001", at: new Date().toISOString(), actor: "시스템", action: "데모 데이터가 준비되었습니다." }],
};

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function supabaseFetch(endpoint, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${endpoint}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    throw new Error(`Supabase 요청 실패: ${message}`);
  }
  return payload;
}

async function readKv(key, fallback, filePath) {
  if (!USE_SUPABASE) return readJson(filePath, fallback);
  const rows = await supabaseFetch(`/rest/v1/app_kv?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
  if (rows.length) return rows[0].value;
  await writeKv(key, fallback, filePath);
  return fallback;
}

async function writeKv(key, value, filePath) {
  if (!USE_SUPABASE) {
    writeJson(filePath, value);
    return;
  }
  await supabaseFetch("/rest/v1/app_kv", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify([{ key, value, mod_date: new Date().toISOString() }]),
  });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) writeJson(filePath, fallback);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function readStore() {
  const store = await readKv("store", demoStore, STORE_PATH);
  store.books = (store.books || []).map(normalizeBook);
  store.scores = store.scores || [];
  store.history = store.history || [];
  store.logs = store.logs || [];
  return store;
}

async function writeStore(store) {
  await writeKv("store", store, STORE_PATH);
}

function normalizeBook(book) {
  const code = String(book.code || book.id || "").trim();
  return {
    ...book,
    code,
    id: code,
    songs: (book.songs || []).map((song, index) => normalizeBookSong(song, index)),
  };
}

function normalizeBookSong(song, index = 0) {
  if (typeof song === "string") {
    return { seq: String(index + 1).padStart(3, "0"), title: song, page: "", preview: "" };
  }
  return {
    seq: String(song.seq || index + 1).trim(),
    title: String(song.title || song.name || "").trim(),
    page: String(song.page || "").trim(),
    preview: String(song.preview || "").trim(),
  };
}

function findBook(store, code) {
  return store.books.find((item) => item.code === code || item.id === code);
}

async function readPermissions() {
  return readKv("permissions", defaultPermissions, PERMISSIONS_PATH);
}

async function writePermissions(permissions) {
  await writeKv("permissions", permissions, PERMISSIONS_PATH);
}

async function readUsers() {
  const users = await readKv("users", defaultUsers, USERS_PATH);
  const permissions = await readPermissions();
  let changed = false;
  const normalized = users
    .filter((user) => user.email !== "director@choir.local")
    .map((user) => {
      if (user.role === "director" || !permissions[user.role]) {
        changed = true;
        return { ...user, role: "officer" };
      }
      return user;
    });
  if (normalized.length !== users.length) changed = true;
  if (changed) await writeUsers(normalized);
  return normalized;
}

async function writeUsers(users) {
  await writeKv("users", users, USERS_PATH);
}

async function readOutbox() {
  return readKv("outbox", [], OUTBOX_PATH);
}

async function writeOutbox(messages) {
  await writeKv("outbox", messages, OUTBOX_PATH);
}

async function addLog(store, user, action) {
  const permissions = await readPermissions();
  const role = user && permissions[user.role] ? user.role : "officer";
  store.logs.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: user ? `${user.name} ${permissions[role].label}` : "시스템",
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

function signSession(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!session.userId || Date.now() > session.exp) return null;
  return session.userId;
}

async function publicUser(user) {
  const permissions = await readPermissions();
  const role = permissions[user.role] ? user.role : "officer";
  return { id: user.id, name: user.name, email: user.email, role, permissions: permissions[role] };
}

async function requireAuth(req, res, next) {
  try {
    const userId = verifySession(parseCookies(req).sid);
    const user = userId && (await readUsers()).find((item) => item.id === userId);
    if (!user) return res.status(401).json({ error: "로그인이 필요합니다." });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requirePermission(permission) {
  return asyncRoute(async (req, res, next) => {
    const permissions = await readPermissions();
    if (!permissions[req.user.role]?.[permission]) return res.status(403).json({ error: "현재 역할에는 권한이 없습니다." });
    next();
  });
}

function canAccessScore(user, score) {
  if (user.role === "guest") return score.access === "all";
  if (score.access === "leaders" || score.access === "director") return user.role === "officer";
  return true;
}

function createTemporaryPassword() {
  return `choir-${crypto.randomBytes(3).toString("hex")}`;
}

async function recordPasswordMail(user, temporaryPassword) {
  const outbox = await readOutbox();
  outbox.unshift({
    id: crypto.randomUUID(),
    to: user.email,
    subject: "[찬양대 자산함] 임시 비밀번호 안내",
    temporaryPassword,
    body: `${user.name}님의 임시 비밀번호는 ${temporaryPassword} 입니다. 로그인 후 비밀번호를 변경해주세요.`,
    at: new Date().toISOString(),
    delivery: "local-outbox",
  });
  await writeOutbox(outbox.slice(0, 50));
}

async function uploadScoreFile(file) {
  if (!file) return { file: "", fileUrl: "" };
  if (!USE_SUPABASE) return { file: file.originalname, fileUrl: `/uploads/${file.filename}` };

  const extension = path.extname(file.originalname).toLowerCase();
  const safeBase = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9가-힣_-]/g, "_").slice(0, 80);
  const objectPath = `scores/${Date.now()}-${crypto.randomUUID()}-${safeBase}${extension}`;
  const body = fs.readFileSync(file.path);

  await supabaseFetch(`/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${encodeURIComponent(objectPath).replace(/%2F/g, "/")}`, {
    method: "POST",
    headers: {
      "Content-Type": file.mimetype || "application/octet-stream",
      "x-upsert": "false",
    },
    body,
  });

  return {
    file: file.originalname,
    fileUrl: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${objectPath}`,
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeBase = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9가-힣_-]/g, "_").slice(0, 80);
    cb(null, `${Date.now()}-${safeBase}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, [".pdf", ".jpg", ".jpeg", ".png"].includes(path.extname(file.originalname).toLowerCase())),
});

const app = express();
app.use(express.json());
app.use("/uploads", requireAuth, express.static(UPLOAD_DIR));
app.use(express.static(ROOT));

app.post(
  "/api/login",
  asyncRoute(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = (await readUsers()).find((item) => item.email.toLowerCase() === email);
    if (!user) return res.status(401).json({ code: "LOGIN_EMAIL_NOT_FOUND", error: "등록되지 않은 아이디입니다." });
    if (user.password !== password) return res.status(401).json({ code: "LOGIN_PASSWORD_MISMATCH", error: "비밀번호가 일치하지 않습니다." });
    res.setHeader("Set-Cookie", `sid=${encodeURIComponent(signSession(user.id))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
    const store = await readStore();
    await addLog(store, user, "로그인했습니다.");
    await writeStore(store);
    res.json({ user: await publicUser(user) });
  }),
);

app.post("/api/logout", requireAuth, (req, res) => {
  res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.post(
  "/api/password-reset",
  asyncRoute(async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const users = await readUsers();
    const user = users.find((item) => item.email.toLowerCase() === email);
    if (!user) return res.status(404).json({ error: "등록된 이메일을 찾을 수 없습니다." });
    const temporaryPassword = createTemporaryPassword();
    user.password = temporaryPassword;
    await writeUsers(users);
    await recordPasswordMail(user, temporaryPassword);
    const store = await readStore();
    await addLog(store, user, "임시 비밀번호를 요청했습니다.");
    await writeStore(store);
    res.json({ ok: true, message: "임시 비밀번호를 등록된 이메일로 전송했습니다.", delivery: "local-outbox" });
  }),
);

app.get(
  "/api/state",
  requireAuth,
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const permissions = await readPermissions();
    const users = await readUsers();
    res.json({
      user: await publicUser(req.user),
      permissions,
      users: await Promise.all(users.map(publicUser)),
      scores: store.scores.filter((score) => canAccessScore(req.user, score)),
      books: store.books,
      history: store.history,
      logs: store.logs,
    });
  }),
);

app.patch(
  "/api/users/:id/role",
  requireAuth,
  requirePermission("managePermissions"),
  asyncRoute(async (req, res) => {
    const permissions = await readPermissions();
    const nextRole = req.body.role;
    if (!permissions[nextRole]) return res.status(400).json({ error: "없는 역할입니다." });
    const users = await readUsers();
    const target = users.find((item) => item.id === req.params.id);
    if (!target) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
    target.role = nextRole;
    await writeUsers(users);
    const store = await readStore();
    await addLog(store, req.user, `${target.name} 사용자의 역할을 ${permissions[nextRole].label}(으)로 변경했습니다.`);
    await writeStore(store);
    res.json({ user: await publicUser(target) });
  }),
);

app.post(
  "/api/users",
  requireAuth,
  requirePermission("managePermissions"),
  asyncRoute(async (req, res) => {
    const permissions = await readPermissions();
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    const role = String(req.body.role || "").trim();
    if (!name || !email || !password || !role) return res.status(400).json({ error: "이름, 이메일, 비밀번호, 권한은 필수입니다." });
    if (!permissions[role]) return res.status(400).json({ error: "없는 권한입니다." });
    const users = await readUsers();
    if (users.some((user) => user.email.toLowerCase() === email)) return res.status(409).json({ error: "이미 등록된 이메일입니다." });
    const user = { id: crypto.randomUUID(), name, email, password, role };
    users.push(user);
    await writeUsers(users);
    const store = await readStore();
    await addLog(store, req.user, `${name} 사용자를 ${permissions[role].label} 권한으로 등록했습니다.`);
    await writeStore(store);
    res.status(201).json({ user: await publicUser(user) });
  }),
);

app.post(
  "/api/roles",
  requireAuth,
  requirePermission("managePermissions"),
  asyncRoute(async (req, res) => {
    const permissions = await readPermissions();
    const role = String(req.body.role || "").trim();
    const label = String(req.body.label || "").trim();
    if (!role || !label) return res.status(400).json({ error: "권한 코드와 권한명은 필수입니다." });
    if (permissions[role]) return res.status(409).json({ error: "이미 등록된 권한입니다." });
    permissions[role] = {
      label,
      hint: String(req.body.hint || `${label} 권한입니다.`).trim(),
      manageScores: Boolean(req.body.manageScores),
      manageBooks: Boolean(req.body.manageBooks),
      manageHistory: Boolean(req.body.manageHistory),
      managePermissions: Boolean(req.body.managePermissions),
    };
    await writePermissions(permissions);
    const store = await readStore();
    await addLog(store, req.user, `${label} 권한을 등록했습니다.`);
    await writeStore(store);
    res.status(201).json({ permissions });
  }),
);

app.post(
  "/api/scores",
  requireAuth,
  requirePermission("manageScores"),
  upload.single("scoreFile"),
  asyncRoute(async (req, res) => {
    const uploaded = await uploadScoreFile(req.file);
    const store = await readStore();
    const score = {
      id: crypto.randomUUID(),
      title: req.body.title,
      date: req.body.date,
      service: req.body.service || "",
      weekSlot: req.body.weekSlot || "current",
      bookTitle: req.body.bookTitle || "",
      page: req.body.page || "",
      part: req.body.part || "합창",
      file: uploaded.file || req.body.file || "",
      fileUrl: uploaded.fileUrl,
      version: req.body.version || "v1.0",
      preview: req.body.preview || "",
      access: req.body.access || "all",
    };
    store.scores.unshift(score);
    await addLog(store, req.user, `찬양곡 "${score.title}"을 등록했습니다.`);
    await writeStore(store);
    res.status(201).json(score);
  }),
);

app.patch(
  "/api/scores/:id",
  requireAuth,
  requirePermission("manageScores"),
  upload.single("scoreFile"),
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const score = store.scores.find((item) => item.id === req.params.id);
    if (!score) return res.status(404).json({ error: "악보를 찾을 수 없습니다." });
    score.title = req.body.title || score.title;
    score.date = req.body.date || score.date;
    score.service = req.body.service || "";
    score.weekSlot = req.body.weekSlot || "current";
    score.bookTitle = req.body.bookTitle || "";
    score.page = req.body.page || "";
    score.part = req.body.part || score.part || "합창";
    score.version = req.body.version || "";
    score.preview = req.body.preview || "";
    score.access = req.body.access || "all";
    if (req.file) {
      const uploaded = await uploadScoreFile(req.file);
      score.file = uploaded.file;
      score.fileUrl = uploaded.fileUrl;
    }
    await addLog(store, req.user, `찬양곡 "${score.title}"을 수정했습니다.`);
    await writeStore(store);
    res.json(score);
  }),
);

app.delete(
  "/api/scores/:id",
  requireAuth,
  requirePermission("manageScores"),
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const score = store.scores.find((item) => item.id === req.params.id);
    store.scores = store.scores.filter((item) => item.id !== req.params.id);
    if (score) await addLog(store, req.user, `찬양곡 "${score.title}"을 삭제했습니다.`);
    await writeStore(store);
    res.json({ ok: true });
  }),
);

app.post(
  "/api/download-log/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const score = store.scores.find((item) => item.id === req.params.id);
    if (!score || !canAccessScore(req.user, score)) return res.status(404).json({ error: "악보를 찾을 수 없습니다." });
    await addLog(store, req.user, `악보 "${score.title}" 다운로드를 기록했습니다.`);
    await writeStore(store);
    res.json({ ok: true });
  }),
);

app.post(
  "/api/books",
  requireAuth,
  requirePermission("manageBooks"),
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const code = String(req.body.code || `book-${crypto.randomUUID()}`).trim();
    if (findBook(store, code)) return res.status(409).json({ error: "이미 등록된 찬양집입니다." });
    const book = { code, id: code, title: req.body.title, stock: Number(req.body.stock || 0), threshold: Number(req.body.threshold || 0), songs: [] };
    store.books.unshift(book);
    await addLog(store, req.user, `찬양집 "${book.title}"을 등록했습니다.`);
    await writeStore(store);
    res.status(201).json(book);
  }),
);

app.patch(
  "/api/books/:code/stock",
  requireAuth,
  requirePermission("manageBooks"),
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const book = findBook(store, req.params.code);
    if (!book) return res.status(404).json({ error: "찬양집을 찾을 수 없습니다." });
    if (req.body.stock !== undefined) {
      book.stock = Math.max(0, Number(req.body.stock || 0));
    } else {
      book.stock = Math.max(0, Number(book.stock) + Number(req.body.delta || 0));
    }
    await addLog(store, req.user, `"${book.title}" 보유 권수를 ${book.stock}권으로 수정했습니다.`);
    await writeStore(store);
    res.json(book);
  }),
);

app.patch(
  "/api/books/:code/songs",
  requireAuth,
  requirePermission("manageBooks"),
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const book = findBook(store, req.params.code);
    if (!book) return res.status(404).json({ error: "찬양집을 찾을 수 없습니다." });
    book.songs = Array.isArray(req.body.songs) ? req.body.songs.map(normalizeBookSong).filter((song) => song.seq && song.title) : [];
    const seqSet = new Set();
    for (const song of book.songs) {
      if (seqSet.has(song.seq)) return res.status(400).json({ error: "같은 찬양집 안에서 seq가 중복될 수 없습니다." });
      seqSet.add(song.seq);
    }
    await addLog(store, req.user, `"${book.title}" 수록곡 목차를 ${book.songs.length}곡으로 수정했습니다.`);
    await writeStore(store);
    res.json(book);
  }),
);

app.delete(
  "/api/books/:code",
  requireAuth,
  requirePermission("manageBooks"),
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const book = findBook(store, req.params.code);
    store.books = store.books.filter((item) => item.code !== req.params.code && item.id !== req.params.code);
    if (book) await addLog(store, req.user, `찬양집 "${book.title}"을 삭제했습니다.`);
    await writeStore(store);
    res.json({ ok: true });
  }),
);

app.post(
  "/api/history",
  requireAuth,
  requirePermission("manageHistory"),
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const row = { id: crypto.randomUUID(), title: req.body.title, date: req.body.date, service: req.body.service || "", media: req.body.media || "" };
    store.history.unshift(row);
    await addLog(store, req.user, `찬양 이력 "${row.title}"을 등록했습니다.`);
    await writeStore(store);
    res.status(201).json(row);
  }),
);

app.delete(
  "/api/history/:id",
  requireAuth,
  requirePermission("manageHistory"),
  asyncRoute(async (req, res) => {
    const store = await readStore();
    const row = store.history.find((item) => item.id === req.params.id);
    store.history = store.history.filter((item) => item.id !== req.params.id);
    if (row) await addLog(store, req.user, `찬양 이력 "${row.title}"을 삭제했습니다.`);
    await writeStore(store);
    res.json({ ok: true });
  }),
);

app.post(
  "/api/reset-demo",
  requireAuth,
  requirePermission("managePermissions"),
  asyncRoute(async (req, res) => {
    await writeStore(demoStore);
    await writeUsers(defaultUsers);
    await writePermissions(defaultPermissions);
    await writeOutbox([]);
    res.json({ ok: true });
  }),
);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "서버 오류가 발생했습니다." });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Choir asset system running at http://localhost:${PORT}`));
}

module.exports = app;
