/** @format */

const socket = io();

const select = vote => {
    document.getElementById("voteA").classList.toggle("selected", vote === "A");
    document.getElementById("voteB").classList.toggle("selected", vote === "B");
};

const editName = () => {
    // ask for a new name
    const name = prompt("Enter your new name:");
    if (name) {
        // send the new name to the server
        socket.emit("editName", { roomId, userId, name });
    }
};

// get room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get("room");
if (room) {
    document.getElementById("roomCode").value = room;
}

// Create new room
createRoomButton.addEventListener("click", async () => {
    const response = await fetch("/create-room", {
        method: "POST",
    });
    const data = await response.json();
    roomId = data.roomId;
    roomIdDisplay.textContent = roomId;
    homeDiv.style.display = "none";
    roomDiv.style.display = "block";

    new QRCode(document.getElementById("qrCode"), {
        text: `http://localhost:3000?room=${roomId}`,
        width: 128,
        height: 128,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H,
    });
});

// Join room
joinRoomForm.addEventListener("submit", async e => {
    e.preventDefault();
    const roomCode = document.getElementById("roomCode").value;
    const userName = document.getElementById("userName").value;

    const response = await fetch("/join-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: roomCode, name: userName }),
    });

    if (response.ok) {
        const data = await response.json();
        roomId = roomCode;
        userNameDisplay.textContent = userName;
        homeDiv.style.display = "none";
        roomDiv.style.display = "block";
        socket.emit("joinRoom", {
            roomId,
            userId: data.userId,
            name: userName,
        });
    }
});

// Vote A
voteAButton.addEventListener("click", () => {
    socket.emit("vote", { roomId, userId, vote: "A" });
});

// Vote B
voteBButton.addEventListener("click", () => {
    socket.emit("vote", { roomId, userId, vote: "B" });
});

const leaveRoom = () => {
    socket.emit("leaveRoom", { roomId, userId });
    window.location.href = "/";
};
// Update votes
socket.on("updateVotes", votes => {
    const totalA = votes.filter(v => v.vote === "A").length;
    const totalB = votes.filter(v => v.vote === "B").length;
    const total = totalA + totalB;

    totalADisplay.textContent = totalA;
    totalBDisplay.textContent = totalB;
    percentADisplay.textContent =
        total > 0 ? `${((totalA / total) * 100).toFixed(2)}%` : "0%";
    percentBDisplay.textContent =
        total > 0 ? `${((totalB / total) * 100).toFixed(2)}%` : "0%";

    voteList.innerHTML = "";
    votes.forEach(v => {
        const li = document.createElement("li");
        li.textContent = `${v.name}: ${v.vote || "No vote yet"}`;
        voteList.appendChild(li);
    });
});
