import KeyListener from "./util/nav.js";
import Socket from "./util/socket.js";
import { User } from "./models/user.js";
import { lerp } from "./util/lerp.js";
import Floor from "./models/floor.js";

const keyListener = new KeyListener();
let packets = [];
let localAvatar = null;
let socket = null;

const app = new PIXI.Application({
  width: 500,
  height: 500,
  backgroundColor: 0x1099bb,
  resolution: window.devicePixelRatio || 1,
});

// Create window frame
let frame = new PIXI.Graphics();
frame.beginFill(0x666666);
frame.lineStyle({ color: 0xffffff, width: 4, alignment: 0 });
frame.drawRect(0, 0, app.width, app.children);
frame.position.set(0, 0);
app.stage.addChild(frame);

let worldContainer = new PIXI.Container();
worldContainer.width = 1000;
worldContainer.height = 1000;

const floor = new Floor();

worldContainer.addChild(floor);
frame.addChild(worldContainer);

// Add container that will hold our masked content
let usersContainer = new PIXI.Container();

// Offset by the window's frame width
// And add the container to the window
worldContainer.addChild(usersContainer);

document.getElementById("world").appendChild(app.view);

export function initWorld(
  localUserID,
  onCreateUser = null,
  onEnterVicinity = null,
  onLeaveVicinity = null
) {
  socket = new Socket();
  socket.connection.onopen = () => {
    joinUser(localUserID);
    keyListener.listenKeys();
  };

  socket.connection.onmessage = (signal) => {
    const payload = JSON.parse(signal.data);
    switch (payload.type) {
      case "init":
        localAvatar = createAvatar(
          payload.data,
          onEnterVicinity,
          onLeaveVicinity,
          true
        );
        // Center world container on local avatar
        worldContainer.position.x =
          500 / 2 - localAvatar.getPos().x - localAvatar.width / 2;
        worldContainer.position.y =
          500 / 2 - localAvatar.getPos().y - localAvatar.height / 2;
        console.log("use pos", localAvatar.getPos());
        console.log("world pos:", worldContainer.position);
        if (onCreateUser) {
          onCreateUser();
        }
        break;
      case "update":
        packets.unshift(payload);
        break;
      case "leave":
        const av = getAvatar(payload.data.userID);
        if (av) {
          usersContainer.removeChild(av);
        }
    }
  };
}

export function setUserTracks(id, video = null, audio = null, screen = null) {
  console.log("setting user tracks: ", id, video, audio);
  const avatar = getAvatar(id);
  if (avatar) {
    avatar.updateTracks(video, audio);
    return;
  }
}

function joinUser(userID) {
  socket.send({
    type: "join",
    data: {
      userID: userID,
    },
  });
}

function createAvatar(data, onEnterVicinity, onLeaveVicinity, isLocal = false) {
  const avatar = new User(
    data.userID,
    data,
    (isLocal = isLocal),
    (onEnterVicinity = onEnterVicinity),
    (onLeaveVicinity = onLeaveVicinity)
  );
  usersContainer.addChild(avatar);
  return avatar;
}

function draw(elapsedMS) {
  if (localAvatar) {
    interpolate(elapsedMS);
  }
}

function update(delta) {
  if (localAvatar) {
    localAvatar.checkProximity(usersContainer.children);
  }

  keyListener.on("w", () => {
    localAvatar.moveY(-4);
    sendData();
    worldContainer.position.y += 4;
  });

  keyListener.on("s", () => {
    localAvatar.moveY(4);
    sendData();
    worldContainer.position.y -= 4;
  });

  keyListener.on("a", () => {
    localAvatar.moveX(-4);
    sendData();
    worldContainer.position.x += 4;
  });

  keyListener.on("d", () => {
    localAvatar.moveX(4);
    sendData();
    worldContainer.position.x -= 4;
  });
}

function interpolate(elapsedMS) {
  if (packets.length === 0) return;
  // Get newest packet
  const packet = packets[0];
  for (let user of packet.data) {
    const userID = user.userID;
    const newX = user.x;
    const newY = user.y;

    let avatar = getAvatar(userID);
    if (!avatar) {
      avatar = createAvatar(user);
      avatar.lastMoveAt = Date.now();
    }

    const lastMoveAt = avatar.lastMoveAt;
    const thisMoveAt = packet.time;
    if (thisMoveAt > lastMoveAt) {
      // Get time difference between this and last move
      const diff = thisMoveAt - lastMoveAt;
      const portion = Date.now() - elapsedMS - lastMoveAt;
      const ratio = portion / diff;

      const lerpedX = lerp(avatar.x, newX, ratio);
      const lerpedY = lerp(avatar.y, newY, ratio);

      if (localAvatar.getId() != userID) {
        // Find this user
        avatar.moveTo(lerpedX, lerpedY);
        avatar.lastMoveAt = packet.time;
      }
    }
  }
  packets.shift();
}

function getAvatar(id) {
  return usersContainer.getChildByName(id);
}

function sendData() {
  const data = {
    userID: localAvatar.getId(),
    x: localAvatar.getPos().x,
    y: localAvatar.getPos().y,
  };
  socket.send({
    type: "input",
    data: data,
  });
}

app.ticker.add((deltaTime) => {
  draw(app.ticker.elapsedMS);
  update(deltaTime);
});
