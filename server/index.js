const express = require("express");
const app = express();

const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 1235 });

const path = require("path");

app.get("/", (req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.use(express.static("client"));

const PORT = 1234;
const HOST = "127.0.0.1";

const userData = {
  users: {},
};


wss.broadcast = (data) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};


function getUserData(doFilter = true) {
  let toSend;
  if (doFilter) {
  for (let key in userData.users) {
    const user = userData.users[key];
    if (!user.lastSent || user.lastUpdated > user.lastSent) {
      user.lastSent = Date.now();
      if (!toSend) {
        toSend = {};
      }
      toSend[user.userID] = user;
    } 
  }
  if (!toSend) {
    return null;
  }
}
toSend = userData.users;
  return JSON.stringify({
    type: "update",
    time: Date.now(),
    data: Array.from(Object.values(toSend))
  });
}

function createUser(id) {
  const user = {
    userID: id,
    x: 100,
    y: 100,
    lastUpdated: Date.now(),
  };
  userData.users[user.userID] = user;
  return user;
}

setInterval(() => {
  let userData = getUserData();
  if (userData === null) {
    return;
  }
  wss.broadcast(userData);
}, 100);


wss.on("connection", ws => {
  ws.on("message", data => {
    const message = JSON.parse(data);
    switch (message.type) {
      case "join":
        const id = message.data.userID;
        const user = createUser(id);
        ws.userID = id;
        console.log("created user", id);
        ws.send(JSON.stringify({
          type: "init",
          time: Date.now(),
          data: user
        }));
        console.log("sent user data:", user);
        ws.send(getUserData(false));
        break;
      case "input":
        userData.users[message.data.userID] = message.data;
        userData.users[message.data.userID].lastUpdated = Date.now();
        break;
    }
  });

  ws.on("close", () => {
    const data = JSON.stringify({
      type: "leave",
      time: Date.now(),
      data: {
        userID: ws.userID,
      }
    });
    wss.broadcast(data);
    delete userData.users[ws.userID];
  });
});

app.listen(PORT);

console.log("Server running at " + HOST + ":" + PORT + "/");