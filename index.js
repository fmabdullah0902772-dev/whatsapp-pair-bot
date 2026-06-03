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

// 🌐 Serve frontend
app.use(express.static(path.join(__dirname, "web")));

let sock;
let latestCode = null;

// 🔥 WhatsApp Start Function
async function startBot(number) {
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" })
    });

    // connection update
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("✅ WhatsApp Connected");
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            if (reason !== DisconnectReason.loggedOut) {
                startBot(number);
            } else {
                console.log("❌ Logged out");
            }
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // 📲 pairing code request
    setTimeout(async () => {
        try {
            let code = await sock.requestPairingCode(number);
            latestCode = code;
            console.log("PAIR CODE:", code);
        } catch (e) {
            console.log("Error:", e.message);
        }
    }, 3000);
}

// 🌐 API: start pairing
app.post("/pair", async (req, res) => {
    const { number } = req.body;

    if (!number) {
        return res.json({ status: "error", message: "Number required" });
    }

    startBot(number);

    res.json({
        status: "success",
        message: "Pairing started"
    });
});

// 📡 API: get code
app.get("/code", (req, res) => {
    res.json({
        code: latestCode
    });
});

// 🌐 Homepage (frontend)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "web", "index.html"));
});

// 🚀 start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
