import fs from "fs";
import path from "path";
import crypto from "crypto";

export function makeStore(root) {
  const dir = path.join(root, "data");
  fs.mkdirSync(path.join(dir, "published"), { recursive: true });
  fs.mkdirSync(path.join(dir, "storage"), { recursive: true });
  fs.mkdirSync(path.join(dir, "versions"), { recursive: true });

  const files = {
    users: path.join(dir, "users.json"),
    projects: path.join(dir, "projects.json"),
    published: path.join(dir, "published-index.json"),
    feedback: path.join(dir, "feedback.json"),
    leads: path.join(dir, "leads.json"),
    sessions: path.join(dir, "sessions.json"),
    analytics: path.join(dir, "analytics.json"),
  };

  const read = (file, fallback) => {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); }
    catch { return fallback; }
  };
  const write = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  };

  const api = {
    dir,
    read,
    write,
    files,
    allUsers: () => read(files.users, []),
    saveUsers: (rows) => write(files.users, rows),
    allProjects: () => read(files.projects, []),
    saveProjects: (rows) => write(files.projects, rows),
    allPublished: () => read(files.published, []),
    savePublished: (rows) => write(files.published, rows),
    push(file, item) {
      const rows = read(file, []);
      rows.push(item);
      write(file, rows);
      return item;
    },
    writePublishedFiles(slug, html, meta = {}) {
      const folder = path.join(dir, "published", slug);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, "index.html"), html);
      fs.writeFileSync(path.join(folder, "meta.json"), JSON.stringify(meta, null, 2));
      return folder;
    },
    readPublishedHtml(slug) {
      const f = path.join(dir, "published", slug, "index.html");
      if (!fs.existsSync(f)) return null;
      return fs.readFileSync(f, "utf8");
    },
    saveVersion(projectId, html, label) {
      const folder = path.join(dir, "versions", projectId);
      fs.mkdirSync(folder, { recursive: true });
      const id = crypto.randomBytes(4).toString("hex");
      const rec = { id, label, at: new Date().toISOString() };
      fs.writeFileSync(path.join(folder, `${id}.html`), html);
      const idxFile = path.join(folder, "index.json");
      const idx = read(idxFile, []);
      idx.unshift(rec);
      write(idxFile, idx.slice(0, 30));
      return rec;
    },
    listVersions(projectId) {
      return read(path.join(dir, "versions", projectId, "index.json"), []);
    },
    readVersion(projectId, id) {
      const f = path.join(dir, "versions", projectId, `${id}.html`);
      if (!fs.existsSync(f)) return null;
      return fs.readFileSync(f, "utf8");
    },
  };

  return api;
}
