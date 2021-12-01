import { showWorld } from "./util/nav.js";
import { initWorld } from "./world.js";

export class Room {
    constructor(url, userName, isGlobal) {
        this.url = url;
        this.userName = userName;
        this.isGlobal = isGlobal;
        this.callObject = DailyIframe.createCallObject({subscribeToTracksAutomatically: false})
        .on("camera-error", (e) => { handleCameraError(this, e) })
        .on("joined-meeting", (e) => { handleJoinedMeeting(this, e) })
        .on("left-meeting", (e) => { handleLeftMeeting(this, e)})
        .on("error", (e) => {handleError(this, e)})
        .on("participant-updated", (e) => {handleParticipantUpdated(this, e)})
        .on("participant-joined", (e) => {handleParticipantJoined(this, e)})
        .on("participant-left", (e) => {handleParticipantLeft(this, e)});
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
  
  function  handleError(room, event) {
    console.error(event);
  }
  
  function  handleJoinedMeeting(room, event) {
      const p = event.participants.local;
      if (room.isGlobal) {
        showWorld();
        initWorld(p.session_id, (sessionID) => {
            subToUserTracks(room, sessionID);
        });
      }
   // updateCallControls(callObject !== null);
  //  const p = event.participants.local;
  //  updateLocal(p);
  }

  function subToUserTracks(room, sessionID) {
    room.callObject.updateParticipant(sessionID, {
        setSubscribedTracks: { audio: true, video: true, screenVideo: false },
      }); 
  }
  
  function handleLeftMeeting() {
    //removeAllTiles();
  }
  
  function handleParticipantUpdated(room, event) {
    const up = event.participant;
    if (up.session_id === room.callObject.participants().local.session_id) {
   //   updateLocal(up);
      return;
    }
  //  const tracks = getParticipantTracks(up);
  //  addOrUpdateTile(up.session_id, up.user_name, tracks.video, tracks.audio);
  
 //  let sv = up.tracks.screenVideo;
  //  checkScreenShare(up.session_id, sv);
  }
  
  function  handleParticipantJoined(room, event) {
    const up = event.participant;
  }
  
  function  getParticipantTracks(participant) {
    const vt = participant?.tracks.video;
    const at = participant?.tracks.audio;
  
    const videoTrack = vt.state === playableState ? vt.persistentTrack : null;
    const audioTrack = at.state === playableState ? at.persistentTrack : null;
    return {
      video: videoTrack,
      audio: audioTrack,
    };
  }
  
  function handleParticipantLeft(room, event) {
    const up = event.participant;
  }