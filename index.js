require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

// Configure CORS to allow one or multiple origins set in FRONTEND_URL
// FRONTEND_URL can be a single origin or a comma-separated list of origins.
// Example: FRONTEND_URL=https://jdih.pu.go.id,http://localhost:5173
const rawOrigins = process.env.FRONTEND_URL || "";
// normalize: trim whitespace and strip trailing slashes
const allowedOrigins = rawOrigins
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: function (incomingOrigin, callback) {
      // If no origin (e.g., server-to-server like curl), allow it
      if (!incomingOrigin) {
        console.log("CORS: no origin header, allowing");
        return callback(null, true);
      }

      const normalizedIncoming = incomingOrigin.replace(/\/+$/, "");

      // If wildcard is configured, allow any origin
      if (allowedOrigins.includes("*")) {
        console.log("CORS: wildcard allowed, origin=", incomingOrigin);
        return callback(null, true);
      }

      // Allow when incoming origin is in the allowed list
      if (allowedOrigins.indexOf(normalizedIncoming) !== -1) {
        console.log("CORS: allowing origin=", incomingOrigin);
        return callback(null, true);
      }

      // Otherwise do not set CORS for this origin (browser will block)
      console.log(
        "CORS: rejecting origin=",
        incomingOrigin,
        "allowed list=",
        allowedOrigins
      );
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Router
const authRouter = require("./routes/authRouter.js");
const userRouter = require("./routes/userRouter.js");
const pelangganRouter = require("./routes/pelangganRouter.js");
const supplierRouter = require("./routes/supplierRouter.js");
const barangRouter = require("./routes/barangRouter.js");
const oprasionalRouter = require("./routes/oprasionalRouter.js");
const transaksiMasukRouter = require("./routes/transaksiMasukRouter.js");
const transaksiKeluarRouter = require("./routes/transaksiKeluarRouter.js");
const dashboardRouter = require("./routes/dashboardRouter.js");
const profileRouter = require("./routes/profileRouter.js");

app.use(authRouter);
app.use(userRouter);
app.use(pelangganRouter);
app.use(supplierRouter);
app.use(barangRouter);
app.use(oprasionalRouter);
app.use(transaksiMasukRouter);
app.use(transaksiKeluarRouter);
app.use(dashboardRouter);
app.use(profileRouter);
// Menjalankan server Express.js
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
