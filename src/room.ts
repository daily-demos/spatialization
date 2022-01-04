import {
  default as DailyIframe,
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEventObjectParticipant,
  DailyParticipant,
  DailyEventObjectTrack,
  DailyEventObjectFatalError,
  DailyEventObjectNoPayload,
  DailyEventObjectCameraError,
  DailyEventObjectParticipants,
} from "@daily-co/daily-js";

import { showJoinForm, showWorld } from "./util/nav";
import { World } from "./world";
import { Pos } from "./worldTypes";

const playableState = "playable";

let world = new World();

type BroadcastData = {
  action: string;
  zoneID: number;
  pos: Pos;
};

export class Room {
  url: string;
  userName: string;
  isGlobal: boolean;
  callObject: DailyCall;
  pendingAcks: { [key: string]: ReturnType<typeof setInterval> } = {};

  constructor(url: string, userName: string, isGlobal = false) {
    this.url = url;
    this.userName = userName;
    this.isGlobal = isGlobal;
    this.callObject = DailyIframe.createCallObject({
      subscribeToTracksAutomatically: false,
      dailyConfig: {
        experimentalChromeVideoMuteLightOff: true,
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
      .on("track-started", (e) => {
        handleTrackStarted(this, e);
      })
      .on("track-stopped", (e) => {
        handleTrackStopped(this, e);
      })
      .on("app-message", (e) => {
        handleAppMessage(this, e);
      });

    const camBtn = document.getElementById("toggleCam");
    camBtn.onclick = () => {
      const current = this.callObject.participants().local.video;
      this.callObject.setLocalVideo(!current);
    };

    const micBtn = document.getElementById("toggleMic");
    micBtn.onclick = () => {
      const current = this.callObject.participants().local.audio;
      this.callObject.setLocalAudio(!current);
    };

    const leaveBtn = document.getElementById("leave");
    leaveBtn.onclick = () => {
      this.callObject.leave();
      this.callObject.destroy();
      world.destroy();
      world = new World();
      showJoinForm();
    };
  }

  async join() {
    try {
      await this.callObject.join({ url: this.url, userName: this.userName });
    } catch (e) {
      console.error(e);
    }
  }

  broadcast(data: BroadcastData, recipientSessionID = "*") {
    this.callObject.sendAppMessage(data, recipientSessionID);
  }
}

function handleCameraError(room: Room, event: DailyEventObjectCameraError) {
  console.error(event);
}

function handleError(room: Room, event: DailyEventObjectFatalError) {
  console.error(event);
}

function handleJoinedMeeting(room: Room, event: DailyEventObjectParticipants) {
  const p = event.participants["local"];
  console.log("JOINED MEETING. session ID, pID", p.session_id, p.user_id);

  const onCreateUser = () => {
    const tracks = getParticipantTracks(p);
    world.setUserTracks(p.session_id, tracks.video, tracks.audio);
  };

  const subToTracks = (sessionID: string) => {
    subToUserTracks(room, sessionID);
  };

  const unsubFromTracks = (sessionID: string) => {
    unsubFromUserTracks(room, sessionID);
  };

  const onMove = (zoneID: number, pos: Pos, recipient: string = "*") => {
    const data = {
      action: "posChange",
      zoneID: zoneID,
      pos: pos,
    };
    room.broadcast(data, recipient);
  };

  const onJoinZone = (sessionID: string, zoneID: number, pos: Pos) => {
    const data = {
      action: "zoneChange",
      zoneID: zoneID,
      pos: pos,
    };
    room.broadcast(data, "*");
  };

  if (room.isGlobal) {
    showWorld();
    world.subToTracks = subToTracks;
    world.unsubFromTracks = unsubFromTracks;
    world.onCreateUser = onCreateUser;
    world.onMove = onMove;
    world.onJoinZone = onJoinZone;
    world.start();
    world.initLocalAvatar(event.participants.local.session_id);
  }
}

function subToUserTracks(room: Room, sessionID: string) {
  room.callObject.updateParticipant(sessionID, {
    setSubscribedTracks: { audio: true, video: true, screenVideo: false },
  });
}

function unsubFromUserTracks(room: Room, sessionID: string) {
  room.callObject.updateParticipant(sessionID, {
    setSubscribedTracks: { audio: false, video: false, screenVideo: false },
  });
}

function handleTrackStarted(room: Room, event: DailyEventObjectTrack) {
  /* const p = event.participant;
  const tracks = getParticipantTracks(p);
  setUserTracks(p.session_id, tracks.video, tracks.audio); */
}

function handleTrackStopped(room: Room, event: DailyEventObjectTrack) {
  /*  const p = event.participant;
  const tracks = getParticipantTracks(p);
  setUserTracks(p.session_id, tracks.video, tracks.audio); */
}

function handleAppMessage(room: Room, event: DailyEventObjectAppMessage) {
  const data = event.data;
  const msgType = data.action;
  switch (msgType) {
    case "zoneChange":
      world.updateParticipantZone(event.fromId, data.zoneID, {
        x: data.pos.x,
        y: data.pos.y,
      });
      break;
    case "posChange":
      const pendingAck = room.pendingAcks[event.fromId];
      if (pendingAck) {
        clearInterval(pendingAck);
        delete room.pendingAcks[event.fromId];
        world.sendDataToParticipant(event.fromId);
      }
      world.updateParticipantPos(
        event.fromId,
        data.zoneID,
        data.pos.x,
        data.pos.y
      );
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
  world.setUserTracks(p.session_id, tracks.video, tracks.audio);
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
  world.sendDataToParticipant(sID);
  room.pendingAcks[sID] = setInterval(() => {
    world.sendDataToParticipant(sID);
  }, 1000);
}

function isRobot(userName: string): Boolean {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
    userName
  );
}

function getParticipantTracks(participant: DailyParticipant) {
  const vt = <{ [key: string]: any }>participant?.tracks?.video;
  const at = <{ [key: string]: any }>participant?.tracks?.audio;

  const videoTrack = vt?.state === playableState ? vt["persistentTrack"] : null;
  const audioTrack = at?.state === playableState ? at["persistentTrack"] : null;
  return {
    video: videoTrack,
    audio: audioTrack,
  };
}

function handleParticipantLeft(room: Room, event: DailyEventObjectParticipant) {
  const up = event.participant;
  world.removeAvatar(up.session_id);
}
