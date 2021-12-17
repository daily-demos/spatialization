import KeyListener from "./util/nav.js";
import { User } from "./models/user.js";
import { lerp, rand } from "./util/lerp.js";
import Floor from "./models/floor.js";

export class World {
  onEnterVicinity = null;
  onLeaveVicinity = null;
  onCreateUser = null;
  onMove = null;

  keyListener = new KeyListener();
  packets = [];
  localAvatar = null;

  app = null;
  worldContainer = null;
  usersContainer = null;

  constructor() {
    this.init();
  }

  setUserTracks(id, video = null, audio = null, screen = null) {
    console.log("setting user tracks: ", id, video, audio);
    const avatar = this.getAvatar(id);
    if (avatar) {
      avatar.updateTracks(video, audio);
      return;
    }
  }

  updateParticipantZone(sessionID, zoneID) {
    const avatar = this.getAvatar(sessionID);
    avatar.zone = zoneID;
  }

  updateParticipantPos(sessionID, posX, posY) {
    const avatar = this.getAvatar(sessionID);
    if (!avatar) {
      avatar = this.createAvatar(sessionID, posX, posY);
    }
    console.log("updating participant pos", avatar, posX, posY);
    avatar.moveTo(posX, posY);
  }

  initLocalAvatar(sessionID) {
    this.localAvatar = this.createAvatar(
      sessionID,
      rand(150, 450),
      rand(150, 450),
      true
    );

    // Center world container on local avatar
    this.worldContainer.position.x =
      500 / 2 - this.localAvatar.getPos().x - this.localAvatar.width / 2;
    this.worldContainer.position.y =
      500 / 2 - this.localAvatar.getPos().y - this.localAvatar.height / 2;
    if (this.onCreateUser) {
      this.onCreateUser();
    }
    const pos = this.localAvatar.getPos();
    this.onMove(this.localAvatar.zoneID, pos.x, pos.y);
    this.keyListener.listenKeys();
  }

  init() {
    this.app = new PIXI.Application({
      width: 500,
      height: 500,
      backgroundColor: 0x1099bb,
      resolution: window.devicePixelRatio || 1,
    });
    // Create window frame
    let frame = new PIXI.Graphics();
    frame.beginFill(0x666666);
    frame.lineStyle({ color: 0xffffff, width: 4, alignment: 0 });
    frame.drawRect(0, 0, this.app.width, this.app.height);
    frame.position.set(0, 0);
    this.app.stage.addChild(frame);

    this.worldContainer = new PIXI.Container();
    this.worldContainer.width = 1000;
    this.worldContainer.height = 1000;

    const floor = new Floor();

    this.worldContainer.addChild(floor);
    frame.addChild(this.worldContainer);

    // Add container that will hold our masked content
    this.usersContainer = new PIXI.Container();

    // Offset by the window's frame width
    // And add the container to the window
    this.worldContainer.addChild(this.usersContainer);

    document.getElementById("world").appendChild(this.app.view);

    this.app.ticker.add((deltaTime) => {
      this.draw(this.app.ticker.elapsedMS);
      this.update(deltaTime);
    });
  }

  createAvatar(userID, x, y, isLocal = false) {
    let onEnterVicinity = null;
    let onLeaveVicinity = null;
    if (isLocal) {
      onEnterVicinity = this.onEnterVicinity;
      onLeaveVicinity = this.onLeaveVicinity;
    }
    const avatar = new User(
      userID,
      userID,
      x,
      y,
      (isLocal = isLocal),
      (onEnterVicinity = onEnterVicinity),
      (onLeaveVicinity = onLeaveVicinity)
    );
    this.usersContainer.addChild(avatar);
    return avatar;
  }

  draw(elapsedMS) {
    if (this.localAvatar) {
      this.interpolate(elapsedMS);
    }
  }

  update(delta) {
    if (this.localAvatar) {
      this.localAvatar.checkProximity(this.usersContainer.children);
    }

    this.keyListener.on("w", () => {
      this.localAvatar.moveY(-4);
      this.sendData();
      this.worldContainer.position.y += 4;
    });

    this.keyListener.on("s", () => {
      this.localAvatar.moveY(4);
      this.sendData();
      this.worldContainer.position.y -= 4;
    });

    this.keyListener.on("a", () => {
      this.localAvatar.moveX(-4);
      this.sendData();
      this.worldContainer.position.x += 4;
    });

    this.keyListener.on("d", () => {
      this.localAvatar.moveX(4);
      this.sendData();
      this.worldContainer.position.x -= 4;
    });
  }

  interpolate(elapsedMS) {
    if (this.packets.length === 0) return;
    // Get newest packet
    const packet = this.packets[0];
    for (let user of packet.data) {
      const userID = user.userID;
      const newX = user.x;
      const newY = user.y;

      let avatar = this.getAvatar(userID);
      if (!avatar) {
        avatar = this.createAvatar(user);
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

        if (this.localAvatar.getId() != userID) {
          // Find this user
          this.avatar.moveTo(lerpedX, lerpedY);
          this.avatar.lastMoveAt = packet.time;
        }
      }
    }
    this.packets.shift();
  }

  getAvatar(id) {
    return this.usersContainer.getChildByName(id);
  }

  sendData() {
    const la = this.localAvatar;
    this.onMove(la.zoneID, la.getPos());
  }
}
