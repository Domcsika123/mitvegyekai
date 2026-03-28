// src/services/feedbackService.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

export type FeedbackStatus = "open" | "in_progress" | "resolved";
export type FeedbackType = "hiba" | "kerdes" | "otlet" | "egyeb";

export interface FeedbackItem {
  id: string;
  site_key: string;

  type: FeedbackType;
  subject: string;
  message: string;
  page_url?: string;

  status: FeedbackStatus;
  admin_note?: string;

  created_at: string; // ISO
  updated_at: string; // ISO
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
const FILE = path.join(DATA_DIR, "feedback.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): FeedbackItem[] {
  ensureDataDir();
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as FeedbackItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: FeedbackItem[]) {
  ensureDataDir();
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2), "utf8");
}

function cleanText(v: any, max = 2000) {
  let s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length > max) s = s.slice(0, max) + "…";
  return s;
}

export function createFeedback(site_key: string, raw: any): FeedbackItem {
  const items = load();
  const now = new Date().toISOString();

  const typeRaw = String(raw?.type || "").trim().toLowerCase();
  const type: FeedbackType =
    typeRaw === "hiba" || typeRaw === "kerdes" || typeRaw === "otlet" || typeRaw === "egyeb"
      ? (typeRaw as FeedbackType)
      : "egyeb";

  const subject = cleanText(raw?.subject, 180);
  const message = cleanText(raw?.message, 4000);
  const page_url = cleanText(raw?.page_url, 500) || undefined;

  if (!subject) throw new Error("A tárgy (subject) kötelező.");
  if (!message) throw new Error("Az üzenet (message) kötelező.");

  const item: FeedbackItem = {
    id: crypto.randomUUID ? crypto.randomUUID() : `fb_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    site_key,
    type,
    subject,
    message,
    page_url,
    status: "open",
    created_at: now,
    updated_at: now,
  };

  items.unshift(item);
  save(items);
  return item;
}

export function listAllFeedback(): FeedbackItem[] {
  return load().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export function listFeedbackForSite(site_key: string): FeedbackItem[] {
  const key = String(site_key || "").trim();
  return listAllFeedback().filter((x) => x.site_key === key);
}

export function updateFeedback(id: string, patch: any): FeedbackItem | null {
  const items = load();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();

  const statusRaw = String(patch?.status || "").trim().toLowerCase();
  if (statusRaw) {
    const ok = statusRaw === "open" || statusRaw === "in_progress" || statusRaw === "resolved";
    if (!ok) throw new Error("Érvénytelen status. Lehet: open | in_progress | resolved");
    items[idx].status = statusRaw as FeedbackStatus;
  }

  if (patch?.admin_note !== undefined) {
    items[idx].admin_note = cleanText(patch.admin_note, 2000) || undefined;
  }

  items[idx].updated_at = now;
  save(items);
  return items[idx];
}
