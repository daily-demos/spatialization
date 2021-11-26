console.log("init");

import { registerJoinFormListener, updateCallControls } from "./nav.js";
import { Participant, localParticipant } from "./participant.js";
import { generateDefaultRoom, Room } from "./room.js";

registerJoinFormListener(initAndJoin);
let room = null;
let callObject = null;
const playableState = "playable";
console.log("starting");

async function initAndJoin(roomURL, name) {
  room = generateDefaultRoom(roomURL);
  console.log("joining");
  callObject = DailyIframe.createCallObject()
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
  const data = event.data[""];
  const sessionID = event.fromId;

  const p = callObject.participants[sessionID];
  const tracks = getParticipantTracks(p);
  // Update tracks if the participant is at the same desk
  if (localParticipant.deskID === data.deskID) {
    room.updateParticipantTracks(sessionID, tracks.video, tracks.audio);
  }
  console.log(event);
}

function handleJoinedMeeting(event) {
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
  const up = event.participant;
  const tracks = getParticipantTracks(up);
  room.updateParticipantTracks(up.session_id, tracks.video, tracks.audio);
}

function handleParticipantJoined(event) {
  const p = event.participant;
  let tracks = getParticipantTracks(p);
  const participant = new Participant(
    p.session_id,
    p.userName,
    tracks.video,
    tracks.audio
  );
  room.addParticipant(participant);
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
