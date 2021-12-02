import { showWorld } from "./util/nav.js";
import { initWorld, setUserTracks } from "./world.js";

const playableState = "playable";
export class Room {
  constructor(url, userName, isGlobal) {
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
      });
  }

  async join() {
    try {
      await this.callObject.join({ url: this.url, userName: this.userName });
    } catch (e) {
      console.error(e);
    }
  }
}

function handleCameraError(room, event) {
  console.error(event);
}

function handleError(room, event) {
  console.error(event);
}

function handleJoinedMeeting(room, event) {
  const p = event.participants.local;

  const onCreateUser = () => {
    const tracks = getParticipantTracks(p);
    setUserTracks(p.session_id, tracks.video, tracks.audio);
  };

  const onEnterEarshot = (sessionID) => {
    subToUserTracks(room, sessionID);
  };

  const onLeaveEarshot = (sessionID) => {
    unsubFromUserTracks(room, sessionID);
  };

  if (room.isGlobal) {
    showWorld();
    initWorld(p.session_id, onCreateUser, onEnterEarshot, onLeaveEarshot);
  }
}

function subToUserTracks(room, sessionID) {
  room.callObject.updateParticipant(sessionID, {
    setSubscribedTracks: { audio: true, video: true, screenVideo: false },
  });
}

function unsubFromUserTracks(room, sessionID) {
  room.callObject.updateParticipant(sessionID, {
    setSubscribedTracks: { audio: false, video: false, screenVideo: false },
  });
}

function handleTrackStarted(room, event) {
  const p = event.participant;
  const tracks = getParticipantTracks(p);
  setUserTracks(p.session_id, tracks.video, tracks.audio);
}

function handleTrackStopped(room, event) {
  const p = event.participant;
  const tracks = getParticipantTracks(p);
  setUserTracks(p.session_id, tracks.video, tracks.audio);
}

function handleLeftMeeting() {
  //removeAllTiles();
}

function handleParticipantUpdated(room, event) {
  const p = event.participant;
  const tracks = getParticipantTracks(p);
  setUserTracks(p.session_id, tracks.video, tracks.audio);
}

function handleParticipantJoined(room, event) {
  const p = event.participant;
  const tracks = getParticipantTracks(p);
  setUserTracks(p.session_id, tracks.video, tracks.audio);
}

function getParticipantTracks(participant) {
  const vt = participant?.tracks.video;
  const at = participant?.tracks.audio;

  const videoTrack = vt?.state === playableState ? vt.persistentTrack : null;
  const audioTrack = at?.state === playableState ? at.persistentTrack : null;
  return {
    video: videoTrack,
    audio: audioTrack,
  };
}

function handleParticipantLeft(room, event) {
  const up = event.participant;
}
