import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { pool } from "./infrastructure/database/client.js";
import cookieParser from "cookie-parser";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// routes
import productsRouter from "./modules/products/products.routes.js";
import authRouter from "./modules/auth/auth.routes.js";
import sellersRouter from "./modules/sellers/sellers.routes.js";
import requestsRouter from "./modules/requests/requests.routes.js";
import conversationRoutes from "./modules/conversations/conversations.routes.js";

app.use(
    cors({
        origin: process.env.WEB_ORIGIN || "http://localhost:3000",
        credentials: true, // allows browser to send senistive data like cookies, headers
    }),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());


app.get("/health", (_req, res) => {
    res.json({
        success: true,
        service: "rewear-api",
        timestamp: new Date().toISOString(),
    });
});


app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/sellers", sellersRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/conversations", conversationRoutes);


const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error(error);

    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
};

app.use(errorHandler);

const server = app.listen(PORT, () => {
    console.log(`ReWear API running at http://localhost:${PORT}`);
});

let isShuttingDown = false;

async function shutdown(signal: string) {
    // 1. Prevent multiple shutdowns from running at once
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`Received ${signal}. Shutting down API...`);

    // 2. Force exit if graceful shutdown takes longer than 10 seconds
    const forceExit = setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);

    // Allow the process to exit naturally if cleanup finishes before the timer
    forceExit.unref();

    // 3. Safely close server and database
    server.close(async (err) => {
        if (err) {
            console.error('Error closing HTTP server:', err);
            process.exit(1);
        }

        try {
            await pool.end();
            console.log('Database pool closed. Exiting cleanly.');
            process.exit(0);
        } catch (dbErr) {
            console.error('Error closing database pool:', dbErr);
            process.exit(1);
        }
    });
}

// Listen for standard termination signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Optional: Catch unexpected runtime crashes
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    shutdown('unhandledRejection');
});
