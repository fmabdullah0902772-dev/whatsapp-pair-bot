const express = require("express");
const path = require("path");
const pino = require("pino");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "web")));

let sock;
let latestCode = null;
let currentNumber = null;

// 🔥 START BOT
async function startBot(number) {
    currentNumber = number;

    const { state, saveCreds } = await useMultiFileAuthState("./session");

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Chrome", "Ubuntu", "1.0.0"],
        logger: pino({ level: "silent" })
    });

    // 🔥 CONNECTION HANDLER
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("✅ WhatsApp Connected");
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                startBot(currentNumber);
            } else {
                console.log("❌ Logged out");
            }
        }
    });

    // 🔥 IMPORTANT: PAIRING CODE HERE (REAL FIX)
    sock.ev.on("connection.update", async (update) => {
        if (update?.pairingCode) {
            latestCode = update.pairingCode;
            console.log("📲 PAIR CODE:", latestCode);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔥 SAFE PAIR REQUEST (FIXED METHOD)
    setTimeout(async () => {
        try {
            if (!number) return;

            console.log("📡 Requesting pairing code...");

            let code = await sock.requestPairingCode(number);
            latestCode = code;

            console.log("📲 PAIR CODE (REQUEST):", code);

        } catch (err) {
            console.log("❌ Pairing error:", err.message);
        }
    }, 5000);
}

// 🌐 API START PAIR
app.post("/pair", async (req, res) => {
    const { number } = req.body;

    if (!number) {
        return res.json({ status: "error", message: "Number required" });
    }

    latestCode = null;

    startBot(number);

    res.json({
        status: "success",
        message: "Pairing started"
    });
});

// 📡 GET CODE
app.get("/code", (req, res) => {
    res.json({
        code: latestCode || null
    });
});

// 🌐 HOME
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "web", "index.html"));
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});
