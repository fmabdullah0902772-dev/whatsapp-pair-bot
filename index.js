const express = require("express");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const app = express();

app.use(express.json());

let sock;
let latestCode = null;

// 🔥 WhatsApp Connection Function
async function startBot(number) {
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" })
    });

    // 🔥 Pairing code generate event
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, pairingCode } = update;

        if (pairingCode) {
            latestCode = pairingCode;
            console.log("PAIRING CODE:", pairingCode);
        }

        if (connection === "open") {
            console.log("✅ WhatsApp Connected!");
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

    // 👇 Request pairing code
    setTimeout(async () => {
        try {
            let code = await sock.requestPairingCode(number);
            console.log("📲 YOUR PAIR CODE:", code);
            latestCode = code;
        } catch (e) {
            console.log("Error generating code:", e.message);
        }
    }, 3000);
}

// 🌐 API ROUTE (frontend yahan call karega)
app.post("/pair", async (req, res) => {
    const { number } = req.body;

    if (!number) {
        return res.json({ status: "error", message: "Number required" });
    }

    startBot(number);

    res.json({
        status: "success",
        message: "Pairing started",
        number: number
    });
});

// 📡 Get latest code
app.get("/code", (req, res) => {
    res.json({
        code: latestCode
    });
});

// 🌐 Home
app.get("/", (req, res) => {
    res.send("WhatsApp Pair Bot Running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
