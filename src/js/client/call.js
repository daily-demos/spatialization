import registerJoinFormListener from "./nav.js";
import { Room } from "./room.js";

registerJoinFormListener(initAndJoin);
let room;

async function initAndJoin(roomURL, name) {
  callObject = DailyIframe.createCallObject()
    .on("camera-error", handleCameraError)
    .on("joined-meeting", handleJoinedMeeting)
    .on("left-meeting", handleLeftMeeting)
    .on("error", handleError)
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

function handleJoinedMeeting(event) {
  // Create the room
  room = new Room(4, 40, 100);
  room.start();
  updateCallControls(true);
  //   const p = event.participants.local;
  //   updateLocal(p);
}

function handleLeftMeeting() {
  console.log("left meeting");
}

function handleParticipantUpdated(event) {
  const up = event.participant;
  if (up.session_id === callObject.participants().local.session_id) {
    updateLocal(up);
    return;
  }
  updateRemote(up);
}

function handleParticipantJoined(event) {
  const up = event.participant;
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

function updateLocal(p) {}

function updatRemote(p) {}
