// src/routes/adminLogin.ts
import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const router = Router();

// MVP token tárolás memóriában
function setAdminToken(token: string) {
  (globalThis as any).__MV_ADMIN_TOKEN__ = token;
}
export function getAdminToken(): string | null {
  return (globalThis as any).__MV_ADMIN_TOKEN__ || null;
}

// Admin felhasználók betöltése JSON-ből vagy env-ből
function loadAdminUsers(): { user: string; pass: string }[] {
  try {
    const filePath = path.join(__dirname, "..", "..", "data", "admin-users.json");
    console.log("[adminLogin] Keresett path:", filePath);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const users = Array.isArray(data.users) ? data.users : [];
      console.log("[adminLogin] Betöltött felhasználók (JSON):", users.map((u: any) => u.user));
      return users;
    } else {
      console.warn("[adminLogin] admin-users.json nem létezik:", filePath);
    }
  } catch (err) {
    console.warn("[adminLogin] Nem lehet betölteni admin-users.json:", err);
  }

  // Fallback: ADMIN_USERS env variable (JSON string)
  const adminUsersEnv = process.env.ADMIN_USERS;
  if (adminUsersEnv) {
    try {
      const users = JSON.parse(adminUsersEnv);
      if (Array.isArray(users)) {
        console.log("[adminLogin] Betöltött felhasználók (ENV):", users.map((u: any) => u.user));
        return users;
      }
    } catch (err) {
      console.warn("[adminLogin] ADMIN_USERS env parse error:", err);
    }
  }

  // Final fallback: env variables
  const envUser = process.env.ADMIN_USER || "admin";
  const envPass = process.env.ADMIN_PASS || "admin";
  console.log("[adminLogin] Fallback felhasználó (ENV vars):", envUser);
  return [{ user: envUser, pass: envPass }];
}

router.post("/login", (req, res) => {
  const { user, pass } = req.body || {};

  const adminUsers = loadAdminUsers();
  const validUser = adminUsers.find((u) => u.user === user && u.pass === pass);

  if (validUser) {
    const token = crypto.randomBytes(32).toString("hex");
    setAdminToken(token);
    return res.json({ ok: true, token });
  }

  return res.status(401).json({ ok: false, error: "Hibás felhasználónév vagy jelszó." });
});

router.post("/logout", (req, res) => {
  setAdminToken("");
  return res.json({ ok: true });
});

export default router;
