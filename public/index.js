/** @format */

let roomId = null;
let userId = null;
let username = sessionStorage.getItem("username") || "Anonymous";

const socket = io();

const voteA = document.getElementById("voteA");
const voteB = document.getElementById("voteB");
const select = vote => {
    voteA.classList.toggle("selected", vote === "A");
    voteB.classList.toggle("selected", vote === "B");
    socket.emit("vote", { roomId, userId, vote });
};

const editName = () => {
    const name = prompt("Enter your new name:");
    if (!name) return;
    username = name;
    sessionStorage.setItem("username", username);
    socket.emit("editName", { roomId, userId, username });
    document.getElementById("userNameDisplay").textContent = username;
};

const leaveRoom = () => {
    socket.emit("leaveRoom", { roomId, userId });
    window.location.href = "/";
};

document.getElementById("userNameDisplay").textContent = username;

const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get("room");
if (room) document.getElementById("roomCode").value = room;

const totalADisplay = document.getElementById("totalA");
const totalBDisplay = document.getElementById("totalB");
const percentADisplay = document.getElementById("percentA");
const percentBDisplay = document.getElementById("percentB");
const voteList = document.getElementById("voteList");
let votesData = [];
socket.on("updateVotes", votes => {
    const totalA = votes.filter(v => v.vote === "A").length;
    const totalB = votes.filter(v => v.vote === "B").length;
    const total = totalA + totalB;

    totalADisplay.textContent = totalA;
    totalBDisplay.textContent = totalB;
    //style="--votes: 20"
    voteA.style = `--votes: ${totalA}`;
    voteB.style = `--votes: ${totalB}`;
    percentADisplay.textContent =
        total > 0 ? `${((totalA / total) * 100).toFixed(2)}%` : "0%";
    percentBDisplay.textContent =
        total > 0 ? `${((totalB / total) * 100).toFixed(2)}%` : "0%";

    voteList.innerHTML = "";
    votes.forEach(v => {
        const li = document.createElement("button");
        li.textContent = `${v.name}: ${v.vote || "No vote yet"}`;
        voteList.appendChild(li);
    });
});

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
