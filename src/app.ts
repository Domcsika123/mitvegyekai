// src/app.ts
import express from "express";
import path from "path";

import recommendRouter from "./routes/recommend";
import adminRouter from "./routes/admin";
import adminLoginRouter from "./routes/adminLogin";
import partnerRouter from "./routes/partner";
import { adminAuth } from "./middleware/adminAuth";

const app = express();

// ✅ Alap middleware-k (emelt body limit nagy importokhoz)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Statikus fájlok (demo.html, admin.html, widget.js, stb.)
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

// Health-check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "MitVegyek API működik" });
});

// ✅ PARTNER API (login + stat + feedback)
app.use("/api/partner", partnerRouter);

// ✅ LOGIN endpoint (NINCS token védelem!)
// POST /api/admin/login
app.use("/api/admin", adminLoginRouter);

// ✅ Admin API – token védelemmel
app.use("/api/admin", adminAuth, adminRouter);

// Nyilvános ajánló API
app.use("/api", recommendRouter);

export default app;
