/** @format */

// Required modules
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");

// Initialize app
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const db = new sqlite3.Database("./database/voting.db");

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//randomId is pure number
const randomId = length =>
    Math.floor(Math.random() * Math.pow(10, length))
        .toString()
        .padStart(length, "0");

// Initialize database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    host TEXT,
    created_at INTEGER
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS votes (
    room_id TEXT,
    user_id TEXT,
    name TEXT,
    vote TEXT,
    PRIMARY KEY (room_id, user_id)
  )`);
});

// Serve homepage
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// if /{six digit number} is entered, it will redirect to the room
app.get("/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    db.get("SELECT id FROM rooms WHERE id = ?", [roomId], (err, room) => {
        if (err || !room) {
            return res.redirect("/");
        }
        res.redirect(`/?room=${roomId}`);
    });
});

app.post("/create-room", (req, res) => {
    let userId = req.cookies.userId;
    if (!userId) {
        userId = randomId(10);
        while (true) {
            db.get(
                "SELECT user_id FROM votes WHERE user_id = ?",
                [userId],
                (err, row) => {
                    if (err || row) {
                        userId = randomId(10);
                    }
                }
            );
            break;
        }
        res.cookie("userId", userId, { httpOnly: false });
    }

    let roomId = randomId(6);
    while (true) {
        db.get("SELECT id FROM rooms WHERE id = ?", [roomId], (err, row) => {
            if (err || row) {
                roomId = randomId(6);
            }
        });
        break;
    }
    const createdAt = Date.now();

    db.run(
        "INSERT INTO rooms (id, host, created_at) VALUES (?, ?, ?)",
        [roomId, userId, createdAt],
        err => {
            if (err) return res.status(500).json({ error: "Database error." });
            res.json({ roomId });
        }
    );
});

// Join a room
app.post("/join-room", (req, res) => {
    const { roomId, name } = req.body;

    db.get("SELECT id FROM rooms WHERE id = ?", [roomId], (err, room) => {
        if (err || !room)
            return res.status(404).json({ error: "Room not found." });

        let userId = req.cookies.userId;
        if (!userId) {
            userId = randomId(10);
            while (true) {
                db.get(
                    "SELECT user_id FROM votes WHERE user_id = ?",
                    [userId],
                    (err, row) => {
                        if (err || row) {
                            userId = randomId(10);
                        }
                    }
                );
                break;
            }
            res.cookie("userId", userId, { httpOnly: false });
        } else {
            db.get(
                "SELECT host FROM rooms WHERE id = ?",
                [roomId],
                (err, row) => {
                    if (err || row.host == userId) {
                        return res.json({ success: true, admin: true });
                    }
                }
            );
        }

        db.run(
            "INSERT OR REPLACE INTO votes (room_id, user_id, name, vote) VALUES (?, ?, ?, ?)",
            [roomId, userId, name, null],
            err => {
                if (err)
                    return res.status(500).json({ error: "Database error." });

                res.json({ success: true, admin: false });
            }
        );
    });
});

io.on("connection", socket => {
    socket.on("joinRoom", ({ roomId, userId, name }) => {
        socket.join(roomId);
        db.run(
            "INSERT OR REPLACE INTO votes (room_id, user_id, name, vote) VALUES (?, ?, ?, ?)",
            [roomId, userId, name, null]
        );
        db.all(
            "SELECT * FROM votes WHERE room_id = ?",
            [roomId],
            (err, rows) => {
                if (!err) {
                    io.to(roomId).emit("updateVotes", rows);
                }
            }
        );
    });

    socket.on("vote", ({ roomId, userId, vote }) => {
        db.run(
            "UPDATE votes SET vote = ? WHERE room_id = ? AND user_id = ?",
            [vote, roomId, userId],
            () => {
                db.all(
                    "SELECT * FROM votes WHERE room_id = ?",
                    [roomId],
                    (err, rows) => {
                        if (!err) {
                            io.to(roomId).emit("updateVotes", rows);
                        }
                    }
                );
            }
        );
    });
    socket.on("editName", ({ roomId, userId, name }) => {
        db.run(
            "UPDATE votes SET name = ? WHERE room_id = ? AND user_id = ?",
            [name, roomId, userId],
            () => {
                db.all(
                    "SELECT * FROM votes WHERE room_id = ?",
                    [roomId],
                    (err, rows) => {
                        if (!err) {
                            io.to(roomId).emit("updateVotes", rows);
                        }
                    }
                );
            }
        );
    });

    socket.on("leaveRoom", ({ roomId, userId }) => {
        db.run(
            "DELETE FROM votes WHERE room_id = ? AND user_id = ?",
            [roomId, userId],
            () => {
                db.all(
                    "SELECT * FROM votes WHERE room_id = ?",
                    [roomId],
                    (err, rows) => {
                        if (!err) {
                            io.to(roomId).emit("updateVotes", rows);
                        }
                    }
                );
            }
        );
        socket.leave(roomId);
    });

    socket.on("deleteUser", ({ roomId, userId }) => {
        db.run(
            "DELETE FROM votes WHERE room_id = ? AND user_id = ?",
            [roomId, userId],
            () => {
                db.all(
                    "SELECT * FROM votes WHERE room_id = ?",
                    [roomId],
                    (err, rows) => {
                        if (!err) {
                            io.to(roomId).emit("updateVotes", rows);
                        }
                    }
                );
            }
        );
    });

    socket.on("disconnect", () => {
        // Handle room cleanup logic here (optional)
    });
});

// Clean up old rooms
setInterval(() => {
    const oneHourAgo = Date.now() - 3600000;
    db.all(
        "SELECT id FROM rooms WHERE created_at < ?",
        [oneHourAgo],
        (err, rows) => {
            if (rows && rows.length > 0) {
                const roomIds = rows.map(row => row.id);

                db.run("DELETE FROM rooms WHERE created_at < ?", [oneHourAgo]);
                db.run(
                    "DELETE FROM votes WHERE room_id IN (" +
                        roomIds.map(() => "?").join(",") +
                        ")",
                    roomIds
                );

                roomIds.forEach(roomId => {
                    io.to(roomId).emit("roomClosed");
                });
            }
        }
    );
}, 60000);

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
