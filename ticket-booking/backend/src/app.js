const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const routes = require('./routes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use(routes);

// Error handling
app.use(errorMiddleware);

module.exports = app;
