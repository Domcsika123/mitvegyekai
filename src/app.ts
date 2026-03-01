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

// ✅ GLOBÁLIS ERROR HANDLER – mindig JSON választ küld hiba esetén
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Express error handler:", err);
  
  // Body-parser error (pl. payload too large, invalid JSON)
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body túl nagy. Maximum: 50MB" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON a request body-ban." });
  }
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Szerverhiba történt.";
  return res.status(status).json({ error: message });
});

export default app;
