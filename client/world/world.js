import KeyListener from "./util/nav.js";
import Socket from "./util/socket.js";
import { User } from "./models/user.js";
import { lerp } from "./util/lerp.js";


const keyListener = new KeyListener();
let packets = [];
let localAvatar = null;
let socket = null;

const app = new PIXI.Application(800, 600, { 
    backgroundColor: 0xFFFF00,
    backgroundAlpha: 1,
});

// Create window frame
let frame = new PIXI.Graphics();
frame.beginFill(0x666666);
frame.lineStyle({ color: 0xffffff, width: 4, alignment: 0 });
frame.drawRect(0, 0, app.width, app.children);
frame.position.set(0,0);
app.stage.addChild(frame);

// Add container that will hold our masked content
let usersContainer = new PIXI.Container(0xFFFF00);
// Offset by the window's frame width
// And add the container to the window
frame.addChild(usersContainer);


document.getElementById("world").appendChild(app.view);


export function initWorld(localUserID, onCreateUser = null, onEnterEarshot = null) {
    socket = new Socket();
    socket.connection.onopen = () => {
      joinUser(localUserID);
      keyListener.listenKeys();
    }

    socket.connection.onmessage = (signal) => {
      const payload = JSON.parse(signal.data);
      switch (payload.type) {
        case "init":
          localAvatar = createAvatar(payload.data, onEnterEarshot, true);
          if (onCreateUser) {
              onCreateUser();
          }
          break;
        case "update":
          packets.unshift(payload);
          break;
        case "leave":
            const av = getAvatar(payload.data.userID)
            if (av) {
            usersContainer.removeChild(av)
        }
      }
    };
  }

export function setUserTracks(id, video = null, audio = null, screen = null) {
    const avatar = getAvatar(id);
    console.log("SETTING USER TRACKS", id, avatar);
    if (avatar) {
        avatar.updateTracks(video, audio);
    }
}

function joinUser(userID) {
    socket.send({
      type: "join",
      data: {
        userID: userID,
      }
    });
  }


function createAvatar(data, onEnterEarshot, isLocal = false) {
    const avatar = new User(data.userID, data, isLocal = isLocal, onEnterEarshot = onEnterEarshot);
    usersContainer.addChild(avatar);
    return avatar;
  }
  

  
  function draw(delta) {
    if (localAvatar) {
      interpolate(delta);
    }
  }
  
  function update(delta) {
    if (localAvatar) {
        localAvatar.checkProximity(usersContainer.children);
    }
   
    keyListener.on("w", () => {
      localAvatar.moveY(-4);
      sendData();
    });
  
    keyListener.on("s", () => {
      localAvatar.moveY(4);
      sendData();
    });
  
  
    keyListener.on("a", () => {
        localAvatar.moveX(-4);
        sendData();
    });
  
    keyListener.on("d", () => {
      localAvatar.moveX(4);
      sendData();
    });
  }
  
  function interpolate(delta) {
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
          }
          const lerpedX = lerp(avatar.x, newX, delta);
          const lerpedY = lerp(avatar.y, newY, delta);

         if (localAvatar.getId() != userID) {
            // Find this user 
            avatar.moveTo(lerpedX, lerpedY);
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
    }
    socket.send({
      type: "input",
      data: data
    });
  }
  
  
  app.ticker.add(deltaTime => {
    draw(deltaTime);
    update(deltaTime);
  
  });