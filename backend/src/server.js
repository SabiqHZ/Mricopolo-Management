require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

const authRoutes = require('./modules/auth/auth.routes');
const authenticate = require('./middlewares/auth.middleware');


app.use('/payments', require('./modules/payments/payments.routes'));
app.use('/returns', require('./modules/returns/returns.routes'));
app.use('/invoices', require('./modules/invoices/invoices.routes'));
app.use('/direct-orders', require('./modules/direct-orders/direct-orders.routes'));
app.use('/droppings', require('./modules/droppings/droppings.routes'));
app.use('/prices', require('./modules/prices/prices.routes'));
app.use('/stores', require('./modules/stores/stores.routes'));
app.use('/products', require('./modules/products/products.routes'));
app.use('/auth', authRoutes);
app.use('/dashboard', require('./modules/dashboard/dashboard.routes'));

app.get('/auth/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user, message: 'Token valid' });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: { status: "ok" },
    message: "Server is running",
  });
});



const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
