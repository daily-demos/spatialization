import { SeatingSpot } from "./desk";
import { DeskID, SpotID, Position, SessionID } from "./types";

export const participantSize = 100;
export const participantPadding = 25;
export let localParticipant: Participant;

let audioCtx: AudioContext;

const posZ = 300;

export class Participant {
  sessionID: SessionID;
  name: string;
  videoTrack: MediaStreamTrack;
  audioTrack: MediaStreamTrack;
  isLocal: boolean;
  seat?: SeatingSpot;
  audio: HTMLAudioElement;
  mutedAudio: HTMLAudioElement;

  constructor(
    sessionID: SessionID,
    name: string,
    vt: MediaStreamTrack,
    at: MediaStreamTrack,
    isLocal = false
  ) {
    this.sessionID = sessionID;
    this.name = name;
    this.videoTrack = vt;
    this.audioTrack = at;
    this.isLocal = isLocal;
    if (!localParticipant && this.isLocal) {
      localParticipant = this;
      audioCtx = new AudioContext();
    }
  }

  getID(): string {
    return `participant-${this.sessionID}`;
  }

  getVideoID(): string {
    return `video-${this.sessionID}`;
  }
  getTileID(): string {
    return `tile-${this.sessionID}`;
  }

  remove() {
    const participantDiv = document.getElementById(this.getID());
    participantDiv.remove();
  }

  updateDesk(seat: SeatingSpot) {
    this.seat = seat;

    if (this.isLocal) {
      console.log("listener set");
      let listener = audioCtx.listener;
      listener.positionX.value = this.seat.position.x;
      listener.positionY.value = this.seat.position.y;
      listener.positionZ.value = posZ - 5;
      listener.forwardX.value = 0;
      listener.forwardY.value = 0;
      listener.forwardZ.value = -1;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    }
    this.render();
  }

  render() {
    if (!this.seat.deskID) {
      console.log("participant not seated");
      return;
    }
    // Get current div if already exists
    let participantDiv = document.getElementById(this.getID());
    let video: HTMLVideoElement;
    if (participantDiv) {
      if (participantDiv.parentElement.id === this.seat.deskID.toString()) {
        video = <HTMLVideoElement>document.getElementById(this.getVideoID());
        this.stream(video);
        return;
      }
      if (participantDiv.parentElement.id !== this.seat.deskID.toString()) {
        participantDiv.remove();
      }
    }
    participantDiv = document.createElement("div");
    participantDiv.id = this.getID();
    participantDiv.classList.add("participant");
    participantDiv.style.top = `${this.seat.position.y}px`;
    participantDiv.style.left = `${this.seat.position.x}px`;

    // Create tile
    const tile = document.createElement("div");
    tile.id = this.getTileID();
    tile.classList.add("tile");
    tile.style.width = `${participantSize}px`;
    tile.style.height = `${participantSize}px`;
    tile.style.backgroundImage = generateLinearGradient();

    // Create video element
    video = <HTMLVideoElement>document.createElement("video");
    video.id = this.getVideoID();
    video.classList.add("fit");
    video.playsInline = true;
    video.autoplay = true;
    if (this.isLocal) {
      video.muted = true;
    }
    tile.appendChild(video);
    participantDiv.appendChild(tile);

    let desk = document.getElementById(this.seat.deskID.toString());
    this.stream(video);
    desk.appendChild(participantDiv);
  }

  private async stream(trackTag: HTMLVideoElement) {
    if (this.seat?.deskID !== localParticipant?.seat.deskID) {
      return;
    }

    // Stop streaming anything if tracks are null
    if (this.videoTrack == null && this.audioTrack == null) {
      trackTag.srcObject = null;
      return;
    }
    if (this.videoTrack) {
      trackTag.srcObject = new MediaStream([this.videoTrack]);
    }
    if (this.audioTrack) {
      if (this.sessionID === localParticipant.sessionID) {
        return;
      }

      const panner = new PannerNode(audioCtx, {
        panningModel: "HRTF",
        distanceModel: "linear",
        positionX: this.seat.position.x,
        positionY: this.seat.position.y,
        positionZ: posZ,
        orientationX: 0.0,
        orientationY: 0.0,
        orientationZ: -1.0,
        refDistance: 1,
        maxDistance: 10000,
        rolloffFactor: 10,
        coneInnerAngle: 60,
        coneOuterAngle: 90,
        coneOuterGain: 0.3,
      });

      let gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);

      const stream = new MediaStream([this.audioTrack]);

      // Apparnetly this is required due to a Chromium bug!
      // https://bugs.chromium.org/p/chromium/issues/detail?id=687574
      // https://stackoverflow.com/questions/55703316/audio-from-rtcpeerconnection-is-not-audible-after-processing-in-audiocontext
      const mutedAudio = new Audio();
      const outputAudio = new Audio();

      mutedAudio.muted = true;
      mutedAudio.srcObject = stream;
      mutedAudio.play();

      const source = audioCtx.createMediaStreamSource(stream);
      const destination = audioCtx.createMediaStreamDestination();

      source.connect(panner);
      panner.connect(destination);
      outputAudio.muted = false;
      outputAudio.srcObject = destination.stream;
      outputAudio.play();
    }
  }
}

function generateLinearGradient() {
  const c1 = Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0");
  const c2 = Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0");
  return `linear-gradient(45deg, #${c1}, #${c2})`;
}
