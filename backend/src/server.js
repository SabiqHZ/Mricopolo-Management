require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// CORS: only the web dashboard's origin(s) may call this API from a browser.
// Non-browser clients (Postman, the Flutter app) send no Origin header and
// are unaffected by this either way. Set CORS_ORIGIN in .env as a
// comma-separated list for multiple environments, e.g.
// CORS_ORIGIN=http://localhost:3000,https://titipjual.example.com
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(morgan("dev"));
app.use(express.json());

const authRoutes = require("./modules/auth/auth.routes");
const authenticate = require("./middlewares/auth.middleware");

app.use("/payments", require("./modules/payments/payments.routes"));
app.use("/returns", require("./modules/returns/returns.routes"));
app.use("/invoices", require("./modules/invoices/invoices.routes"));

app.use(
  "/direct-orders",
  require("./modules/direct-orders/direct-orders.routes"),
);

app.use("/droppings", require("./modules/droppings/droppings.routes"));
app.use("/prices", require("./modules/prices/prices.routes"));
app.use("/stores", require("./modules/stores/stores.routes"));
app.use("/products", require("./modules/products/products.routes"));
app.use("/auth", authRoutes);
app.use("/dashboard", require("./modules/dashboard/dashboard.routes"));

// Reporting
app.use("/reports", require("./modules/reports/reports.routes"));

app.get("/auth/me", authenticate, (req, res) => {
  res.json({
    success: true,
    data: req.user,
    message: "Token valid",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: { status: "ok" },
    message: "Server is running",
  });
});

// 404 — no route matched. Must come after every app.use(route) above.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
});

// Global error handler — must be registered last, and must take exactly
// 4 arguments for Express to recognize it as an error handler.
// Express 5 auto-forwards rejected promises from async route handlers here,
// so this is what guarantees every error (not just the ones each controller
// explicitly catches) still returns the standard {success:false,error:{}}
// envelope instead of Express's own default error page.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error(err);

  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      error: { code: "CORS_FORBIDDEN", message: "Origin not allowed" },
    });
  }

  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
