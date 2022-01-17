import {
  default as DailyIframe,
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEventObjectParticipant,
  DailyParticipant,
  DailyEventObjectFatalError,
  DailyEventObjectNoPayload,
  DailyEventObjectCameraError,
  DailyEventObjectParticipants,
  DailyEventObjectNetworkConnectionEvent,
} from "@daily-co/daily-js";
import { globalZoneID, standardTileSize } from "./config";

import {
  registerCamBtnListener,
  registerLeaveBtnListener,
  registerMicBtnListener,
  showJoinForm,
  showWorld,
  updateCamBtn,
  updateMicBtn,
} from "./util/nav";
import { World } from "./world";
import { Pos, ZoneData } from "./worldTypes";

const playableState = "playable";

let world = new World();

type BroadcastData = {
  action: string;
  zoneData?: ZoneData;
  pos?: Pos;
};

type State = {
  audio?: boolean;
  video?: boolean;
};

enum BandwidthLevel {
  Unknown = 0,
  Tile,
  Focus,
}

enum Topology {
  Unknown = 0,
  P2P,
  SFU,
}

export class Room {
  url: string;
  userName: string;
  isGlobal: boolean;
  callObject: DailyCall;
  pendingAcks: { [key: string]: ReturnType<typeof setInterval> } = {};
  localBandwidthLevel = BandwidthLevel.Unknown;
  localState: State = { audio: null, video: null };
  topology: Topology;

  constructor(url: string, userName: string, isGlobal = false) {
    this.url = url;
    this.userName = userName;
    this.isGlobal = isGlobal;
    this.callObject = DailyIframe.createCallObject({
      subscribeToTracksAutomatically: false,
      dailyConfig: {
        experimentalChromeVideoMuteLightOff: true,
        camSimulcastEncodings: [{ maxBitrate: 600000, maxFramerate: 30 }],
      },
    })
      .on("camera-error", (e) => {
        handleCameraError(this, e);
      })
      .on("joined-meeting", (e) => {
        handleJoinedMeeting(this, e);
      })
      .on("left-meeting", (e) => {
        handleLeftMeeting(this, e);
      })
      .on("error", (e) => {
        handleError(this, e);
      })
      .on("participant-updated", (e) => {
        handleParticipantUpdated(this, e);
      })
      .on("participant-joined", (e) => {
        handleParticipantJoined(this, e);
      })
      .on("participant-left", (e) => {
        handleParticipantLeft(this, e);
      })
      .on("app-message", (e) => {
        handleAppMessage(this, e);
      })
      .on("network-connection", (e) => {
        handleNetworkConnectionChanged(this, e);
      });

    registerCamBtnListener(() => {
      const current = this.callObject.participants().local.video;
      this.callObject.setLocalVideo(!current);
    });

    registerMicBtnListener(() => {
      const current = this.callObject.participants().local.audio;
      console.log("toggling mic to:", !current);
      this.callObject.setLocalAudio(!current);
    });

    registerLeaveBtnListener(() => {
      this.callObject.leave();
      this.callObject.destroy();
      world.destroy();
      world = new World();
      showJoinForm();
    });
  }

  async join() {
    try {
      await this.callObject.join({ url: this.url, userName: this.userName });
    } catch (e) {
      console.error(e);
      showJoinForm();
    }
  }

  broadcast(data: BroadcastData, recipientSessionID = "*") {
    this.callObject.sendAppMessage(data, recipientSessionID);
  }

  setBandwidth(level: BandwidthLevel) {
    if (this.localBandwidthLevel === level) {
      return;
    }
    switch (level) {
      case BandwidthLevel.Tile:
        this.localBandwidthLevel = level;
        this.callObject.setBandwidth({
          trackConstraints: {
            width: standardTileSize,
            height: standardTileSize,
            frameRate: 15,
          },
        });
        break;
      case BandwidthLevel.Focus:
        this.localBandwidthLevel = level;
        this.callObject.setBandwidth({
          trackConstraints: { width: 200, height: 200, frameRate: 30 },
        });
        break;
    }
  }

  updateLocal(p: DailyParticipant) {
    if (this.localState.audio != p.audio) {
      this.localState.audio = p.audio;
      updateMicBtn(this.localState.audio);
    }
    if (this.localState.video != p.video) {
      this.localState.video = p.video;
      updateCamBtn(this.localState.video);
    }
  }
}

function handleCameraError(room: Room, event: DailyEventObjectCameraError) {
  console.error(`camera error in room ${room.url}": ${event}`);
}

function handleError(room: Room, event: DailyEventObjectFatalError) {
  console.error(`error in room ${room.url}": ${event}`);
}

function handleJoinedMeeting(room: Room, event: DailyEventObjectParticipants) {
  const p = event.participants["local"];
  console.log("JOINED MEETING. session ID, pID", p.session_id, p.user_id);
  room.setBandwidth(BandwidthLevel.Tile);

  const onCreateUser = () => {
    const tracks = getParticipantTracks(p);
    world.updateUser(p.session_id, p.user_name, tracks.video, tracks.audio);
  };

  const subToTracks = (sessionID: string) => {
    subToUserTracks(room, sessionID);
  };

  const unsubFromTracks = (sessionID: string) => {
    unsubFromUserTracks(room, sessionID);
  };

  const onMove = (pos: Pos, recipient: string = "*") => {
    const data = {
      action: "posChange",
      pos: pos,
    };
    room.broadcast(data, recipient);
  };

  const onJoinZone = (zoneData: ZoneData, recipient: string = "*") => {
    if (zoneData.zoneID === 0) {
      room.setBandwidth(BandwidthLevel.Tile);
    } else {
      room.setBandwidth(BandwidthLevel.Focus);
    }
    const data = {
      action: "zoneChange",
      zoneData: zoneData,
    };
    room.broadcast(data, recipient);
  };

  const onDataDump = (zoneData: ZoneData, posData: Pos, recipient: "*") => {
    const data = {
      action: "dump",
      pos: posData,
      zoneData: zoneData,
    };
    room.broadcast(data, recipient);
  };

  if (room.isGlobal) {
    const local = event.participants.local;
    showWorld();
    world.subToTracks = subToTracks;
    world.unsubFromTracks = unsubFromTracks;
    world.onCreateUser = onCreateUser;
    world.onMove = onMove;
    world.onJoinZone = onJoinZone;
    world.onDataDump = onDataDump;
    world.start();
    world.initLocalUser(local.session_id);
  }
}

function subToUserTracks(room: Room, sessionID: string) {
  room.callObject.updateParticipant(sessionID, {
    setSubscribedTracks: { audio: true, video: true, screenVideo: false },
  });
}

function unsubFromUserTracks(room: Room, sessionID: string) {
  // Unsubscriptions are not supported in peer-to-peer  mode. Attempting
  // to unsubscribe in P2P mode will silently fail, so let's not even try.
  if (room.topology !== Topology.SFU) return;

  room.callObject.updateParticipant(sessionID, {
    setSubscribedTracks: { audio: false, video: false, screenVideo: false },
  });
}

function handleAppMessage(room: Room, event: DailyEventObjectAppMessage) {
  const data = <BroadcastData>event.data;
  const msgType = data.action;
  switch (msgType) {
    case "dump":
      const pendingAck = room.pendingAcks[event.fromId];
      if (pendingAck) {
        clearInterval(pendingAck);
        delete room.pendingAcks[event.fromId];
        world.sendDataDumpToParticipant(event.fromId);
      }
      world.updateParticipantZone(
        event.fromId,
        data.zoneData.zoneID,
        data.zoneData.spotID
      );
      if (data.zoneData.zoneID === globalZoneID) {
        world.updateParticipantPos(event.fromId, data.pos.x, data.pos.y);
      }
      break;
    case "zoneChange":
      world.updateParticipantZone(
        event.fromId,
        data.zoneData.zoneID,
        data.zoneData.spotID
      );
      break;
    case "posChange":
      world.updateParticipantPos(event.fromId, data.pos.x, data.pos.y);
      break;
  }
}

function handleLeftMeeting(room: Room, event: DailyEventObjectNoPayload) {}

function handleParticipantUpdated(
  room: Room,
  event: DailyEventObjectParticipant
) {
  const p = event.participant;
  const tracks = getParticipantTracks(p);
  world.updateUser(p.session_id, p.user_name, tracks.video, tracks.audio);
  if (p.session_id === room.callObject.participants().local.session_id) {
    room.updateLocal(p);
  }
}

function handleParticipantJoined(
  room: Room,
  event: DailyEventObjectParticipant
) {
  const sID = event.participant.session_id;
  if (isRobot(event.participant.user_name)) {
    world.createRobot(sID);
    return;
  }
  world.initRemoteParticpant(sID, event.participant.user_name);
  world.sendZoneDataToParticipant(sID);
  world.sendPosDataToParticipant(sID);
  room.pendingAcks[sID] = setInterval(() => {
    world.sendDataDumpToParticipant(sID);
  }, 1000);
}

function isRobot(userName: string): Boolean {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
    userName
  );
}

function getParticipantTracks(participant: DailyParticipant) {
  const tracks = participant?.tracks;
  if (!tracks) return { video: null, audio: null };

  const vt = <{ [key: string]: any }>tracks.video;
  const at = <{ [key: string]: any }>tracks.audio;

  const videoTrack = vt?.state === playableState ? vt["persistentTrack"] : null;
  const audioTrack = at?.state === playableState ? at["persistentTrack"] : null;
  return {
    video: videoTrack,
    audio: audioTrack,
  };
}

function handleParticipantLeft(room: Room, event: DailyEventObjectParticipant) {
  const up = event.participant;
  world.removeUser(up.session_id);
}

function handleNetworkConnectionChanged(
  room: Room,
  event: DailyEventObjectNetworkConnectionEvent
) {
  if (event.event !== "connected") return;
  console.log("Network connection changed. Type:", event.type);
  switch (event.type) {
    case "peer-to-peer":
      room.topology = Topology.P2P;
      break;
    case "sfu":
      room.topology = Topology.SFU;
      break;
  }
}
