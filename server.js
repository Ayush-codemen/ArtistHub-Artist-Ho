/**
 * server.js — Custom Next.js server with Socket.io
 *
 * Why this file exists:
 *   Next.js App Router API routes are serverless functions — they spin up and
 *   tear down per request, so they cannot hold a persistent WebSocket connection.
 *   This file wraps the Next.js request handler with a long-lived Node.js HTTP
 *   server and attaches Socket.io to it.
 *
 * Start with:  node server.js   (or via `npm run start:ws`)
 */

const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const { Server } = require("socket.io")
const { MongoClient } = require("mongodb")
const { randomUUID } = require("crypto")
const jwt = require("jsonwebtoken")

const dev = process.env.NODE_ENV !== "production"
const port = parseInt(process.env.PORT || "3000", 10)
const MONGO_URI = process.env.MONGODB_URL || process.env.MONGODB_URI
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

const app = next({ dev })
const handle = app.getRequestHandler()

// ── MongoDB connection (shared across all socket handlers) ──
let db = null
async function getDb() {
  if (db) return db
  const client = new MongoClient(MONGO_URI)
  await client.connect()
  db = client.db()
  console.log("[socket] MongoDB connected")
  return db
}

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  // ── Attach Socket.io to the same HTTP server ──
  const io = new Server(httpServer, {
    cors: {
      origin: "*",               // tighten in production
      methods: ["GET", "POST"],
    },
    path: "/api/socketio",       // custom path avoids conflict with Next.js routes
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Authentication Middleware
  // Validates JWT from socket.auth.token before allowing any event handling.
  // ─────────────────────────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error("Authentication required"))

    try {
      const payload = jwt.verify(token, JWT_SECRET)
      socket.userId = payload.userId
      next()
    } catch {
      next(new Error("Invalid or expired token"))
    }
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Socket Event Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`[socket] User connected: ${socket.userId} (${socket.id})`)

    /**
     * join_conversation
     * Client emits this when opening a chat window.
     * Server adds the socket to a room named after the conversationId so that
     * messages are broadcast only to users in that specific conversation.
     */
    socket.on("join_conversation", async ({ conversationId }) => {
      if (!conversationId) return

      try {
        const database = await getDb()
        const conv = await database
          .collection("conversations")
          .findOne({ _id: conversationId })

        if (!conv) return socket.emit("error", { message: "Conversation not found" })

        // Security: only participants may join the room
        if (!conv.participants.includes(socket.userId)) {
          return socket.emit("error", { message: "Forbidden" })
        }

        socket.join(conversationId)
        console.log(`[socket] ${socket.userId} joined room: ${conversationId}`)
      } catch (err) {
        console.error("[socket] join_conversation error:", err)
      }
    })

    /**
     * leave_conversation
     * Client emits this when navigating away from a chat.
     */
    socket.on("leave_conversation", ({ conversationId }) => {
      if (conversationId) {
        socket.leave(conversationId)
        console.log(`[socket] ${socket.userId} left room: ${conversationId}`)
      }
    })

    /**
     * send_message
     * Client emits this to send a message. Server:
     *   1. Validates the sender is a conversation participant
     *   2. Persists the message to MongoDB
     *   3. Broadcasts receive_message to everyone in the conversation room
     */
    socket.on("send_message", async ({ conversationId, content }) => {
      if (!conversationId || !content?.trim()) return

      try {
        const database = await getDb()

        // Validate participation
        const conv = await database
          .collection("conversations")
          .findOne({ _id: conversationId })

        if (!conv || !conv.participants.includes(socket.userId)) {
          return socket.emit("error", { message: "Forbidden" })
        }

        const now = new Date().toISOString()
        const messageId = randomUUID()

        const newMessage = {
          _id: messageId,
          conversationId,
          senderId: socket.userId,
          content: content.trim().slice(0, 5000),
          readBy: [socket.userId],
          createdAt: now,
        }

        // Persist to MongoDB
        await Promise.all([
          database.collection("messages").insertOne(newMessage),
          database.collection("conversations").updateOne(
            { _id: conversationId },
            { $set: { lastMessageAt: now } }
          ),
        ])

        // Broadcast to the conversation room (includes sender for confirmation)
        // ─── Junction 1: SERVER pre-emit log ───────────────────────────────
        console.log(
          'SERVER 📤 Attempting to emit receive_message to room:', conversationId,
          '\n  Payload:', JSON.stringify({ _id: messageDoc._id, senderId: socket.data.userId, content, senderName: socket.data.userName })
        )
        io.to(conversationId).emit("receive_message", {
          ...newMessage,
          id: messageId,
        })

        console.log(`[socket] Message sent in ${conversationId} by ${socket.userId}`)
      } catch (err) {
        console.error("[socket] send_message error:", err)
        socket.emit("error", { message: "Failed to send message" })
      }
    })

    /**
     * disconnect — cleanup
     */
    socket.on("disconnect", (reason) => {
      console.log(`[socket] User disconnected: ${socket.userId} (${reason})`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} [${dev ? "development" : "production"}]`)
    console.log(`> Socket.io attached at /api/socketio`)
  })
})
