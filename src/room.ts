import {
  default as DailyIframe,
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEvent,
  DailyEventObjectParticipant,
  DailyParticipantsObject,
  DailyParticipant,
  DailyEventObjectTrack,
  DailyEventObjectFatalError,
  DailyEventObjectNoPayload,
  DailyEventObjectCameraError,
  DailyEventObjectParticipants,
} from "@daily-co/daily-js";

import { showWorld } from "./util/nav";
import { World } from "./world";

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

  constructor(url: string, userName: string, isGlobal = false) {
    this.url = url;
    this.userName = userName;
    this.isGlobal = isGlobal;
    this.callObject = DailyIframe.createCallObject({
      subscribeToTracksAutomatically: false,
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

  const onCreateUser = () => {
    const tracks = getParticipantTracks(p);
    world.setUserTracks(p.session_id, tracks.video, tracks.audio);
  };

  const onEnterVicinity = (sessionID: string) => {
    subToUserTracks(room, sessionID);
  };

  const onLeaveVicinity = (sessionID: string) => {
    console.log("onLeaveVicinity", sessionID);
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

  if (room.isGlobal) {
    showWorld();
    world.onEnterVicinity = onEnterVicinity;
    world.onLeaveVicinity = onLeaveVicinity;
    world.onCreateUser = onCreateUser;
    world.onMove = onMove;
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
      world.updateParticipantZone(event.fromId, data.zoneID);
      break;
    case "posChange":
      world.updateParticipantPos(event.fromId, data.pos.x, data.pos.y);
      break;
  }
}

function handleLeftMeeting(room: Room, event: DailyEventObjectNoPayload) {
  //removeAllTiles();
}

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
  world.sendDataToParticipant(event.participant.session_id);
}

function getParticipantTracks(participant: DailyParticipant) {
  const vt = participant?.tracks.video;
  const at = participant?.tracks.audio;

  const videoTrack = vt?.state === playableState ? vt.track : null;
  const audioTrack = at?.state === playableState ? at.track : null;
  return {
    video: videoTrack,
    audio: audioTrack,
  };
}

function handleParticipantLeft(room: Room, event: DailyEventObjectParticipant) {
  const up = event.participant;
}
