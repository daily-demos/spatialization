var exports = {};
console.log("init");

import { registerJoinFormListener, updateCallControls } from "./nav.js";
import { Participant, localParticipant } from "./participant.js";
import { generateDefaultRoom, Room } from "./room.js";

registerJoinFormListener(initAndJoin);
let room = null;
let callObject = null;
const playableState = "playable";
const participantMovedMsg = "participant-moved";
console.log("starting");

async function initAndJoin(roomURL, name) {
  console.log("joining");
  callObject = DailyIframe.createCallObject({
    subscribeToTracksAutomatically: true,
  })
    .on("camera-error", handleCameraError)
    .on("joined-meeting", handleJoinedMeeting)
    .on("left-meeting", handleLeftMeeting)
    .on("error", handleError)
    .on("app-message", handleAppMessage)
    .on("participant-updated", handleParticipantUpdated)
    .on("participant-joined", handleParticipantJoined)
    .on("participant-left", handleParticipantLeft);
  try {
    console.log("Joining " + roomURL);
    await callObject.join({ url: roomURL, userName: name });
  } catch (e) {
    console.error(e);
  }
}

function handleCameraError(event) {
  console.error(event);
}

function handleError(event) {
  console.error(event);
}

function handleAppMessage(event) {
  const data = event.data;
  if (data.name === participantMovedMsg) {
    room.seatParticipant(event.fromId, event.deskID, event.spotID);
    if (event.deskID === localParticipant.deskID) {
      callObject.updateParticipant("b95ec8cc-499f-480c-f68c-3373c8553693", {
        setSubscribedTracks: {
          audio: true,
          video: "staged",
          screenVideo: false,
        },
      });
      const p = callObject.participants[sessionID];
      const tracks = getParticipantTracks(p);
      room.updateParticipantTracks(sessionID, tracks.video, tracks.audio);
    }
  }

  // console.log(event);
}

function handleJoinedMeeting(event) {
  if (!room) {
    room = generateDefaultRoom(roomURL, handleParticipantSeated);
  }
  updateCallControls(true);
  const p = event.participants.local;
  const tracks = getParticipantTracks(p);
  const local = new Participant(
    p.session_id,
    p.userName,
    tracks.video,
    tracks.audio,
    true
  );
  room.addParticipant(local);
}

function handleLeftMeeting() {
  console.log("left meeting");
}

function handleParticipantUpdated(event) {
  if (!room) {
    room = generateDefaultRoom(roomURL, handleParticipantSeated);
  }
  const up = event.participant;
  const tracks = getParticipantTracks(up);
  room.updateParticipantTracks(up.session_id, tracks.video, tracks.audio);
}

function handleParticipantJoined(event) {
  if (!room) {
    room = generateDefaultRoom(roomURL, handleParticipantSeated);
  }
  const p = event.participant;
  let tracks = getParticipantTracks(p);
  const participant = new Participant(
    p.session_id,
    p.userName,
    tracks.video,
    tracks.audio
  );
  room.addParticipant(participant);
  // Send local position to this participant
}

function getParticipantTracks(participant) {
  const vt = participant?.tracks.video;
  const at = participant?.tracks.audio;

  const videoTrack = vt.state === playableState ? vt.persistentTrack : null;
  const audioTrack = at.state === playableState ? at.persistentTrack : null;
  return {
    video: videoTrack,
    audio: audioTrack,
  };
}

function handleParticipantLeft(event) {
  const up = event.participant;
}

function handleParticipantSeated(deskID, spotID) {
  callObject.sendAppMessage(
    {
      name: participantMovedMsg,
      deskID: deskID,
      spotID: spotID,
    },
    "*"
  );
}
