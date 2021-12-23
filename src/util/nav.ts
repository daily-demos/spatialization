export default class KeyListener {
  pressedKeys: { [key: string]: boolean } = {};

  on(key: string, f: Function) {
    if (this.pressedKeys[key]) {
      f();
    } else {
      return false;
    }
  }

  listenKeys() {
    window.onkeydown = (e) => {
      this.pressedKeys[e.key] = true;
    };
    window.onkeyup = (e) => {
      this.pressedKeys[e.key] = false;
    };
  }
}

const joinForm = document.getElementById("enterCall");
const nav = document.getElementById("nav");

export function registerJoinFormListener(f: Function) {
  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinForm.style.display = "none";
    const nameEle = <HTMLInputElement>document.getElementById("userName");
    const urlEle = <HTMLInputElement>document.getElementById("roomURL");
    f(nameEle.value, urlEle.value);
  });
}

export function showWorld() {
  const worldDiv = document.getElementById("world");
  const entryDiv = document.getElementById("entry");
  const controlsDiv = document.getElementById("controls");
  worldDiv.style.display = "inline-block";
  entryDiv.style.display = "none";
  controlsDiv.style.display = "block";
}

export function showBroadcast(
  videoTrack?: MediaStreamTrack,
  audioTrack?: MediaStreamTrack
) {
  console.log("showing broadcast");
  const tracks: Array<MediaStreamTrack> = [];
  if (videoTrack) tracks.push(videoTrack);
  if (audioTrack) tracks.push(audioTrack);
  if (tracks.length > 0) {
    const vid = <HTMLVideoElement>document.getElementById("broadcastVideo");
    vid.srcObject = new MediaStream(tracks);
  }
}

export function stopBroadcast() {
  const vid = <HTMLVideoElement>document.getElementById("broadcastVideo");
  vid.srcObject = null;
}

export function showZonemate(
  sessionID: string,
  videoTrack?: MediaStreamTrack,
  audioTrack?: MediaStreamTrack
) {
  console.log("showing zonemate", videoTrack, audioTrack);

  let zonemate = <HTMLDivElement>(
    document.getElementById(getZonemateTagID(sessionID))
  );
  if (!zonemate) {
    zonemate = createZonemate(sessionID);
  }
  const tracks: Array<MediaStreamTrack> = [];
  if (videoTrack) tracks.push(videoTrack);
  if (audioTrack) tracks.push(audioTrack);
  if (tracks.length === 0) return;

  const vid = <HTMLVideoElement>(
    document.getElementById(getVideoTagID(sessionID))
  );
  vid.srcObject = new MediaStream(tracks);
}

function createZonemate(sessionID: string): HTMLDivElement {
  const zonemates = document.getElementById("zonemates");
  const zID = getZonemateTagID(sessionID);
  let zonemate = document.createElement("div");
  zonemate.id = zID;
  zonemates.appendChild(zonemate);

  const nameTag = document.createElement("div");
  nameTag.innerText = sessionID;
  zonemate.appendChild(nameTag);

  const zonemateTag = document.createElement("div");
  zonemateTag.classList.add("zonemateVid");
  zonemate.appendChild(zonemateTag);

  const vID = getVideoTagID(sessionID);
  const vid = document.createElement("video");
  vid.classList.add("fit");
  vid.autoplay = true;
  vid.id = vID;
  zonemateTag.appendChild(vid);
  return zonemate;
}

export function removeZonemate(sessionID: string) {
  const ele = document.getElementById(getZonemateTagID(sessionID));
  console.log("removing zonemate", getZonemateTagID(sessionID), ele);
  if (ele) ele.remove();
}

export function removeAllZonemates() {
  const zonemates = document.getElementById("zonemates");
  zonemates.textContent = "";
}

function getVideoTagID(sessionID: string): string {
  return `video-${sessionID}`;
}

function getZonemateTagID(sessionID: string): string {
  return `zonemate-${sessionID}`;
}
