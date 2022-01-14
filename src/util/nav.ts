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
const broadcastDiv = <HTMLDivElement>document.getElementById("broadcast");
const broadcastVideo = <HTMLVideoElement>(
  document.getElementById("broadcastVideo")
);
const broadcastName = <HTMLDivElement>document.getElementById("broadcastName");
const toggleCamBtn = document.getElementById("toggleCam");
const toggleMicBtn = document.getElementById("toggleMic");

export function registerCamBtnListener(f: () => void) {
  toggleCamBtn.addEventListener("click", f);
}

export function registerMicBtnListener(f: () => void) {
  toggleMicBtn.addEventListener("click", f);
}

export function registerLeaveBtnListener(f: () => void) {
  const leaveBtn = document.getElementById("leave");
  leaveBtn.addEventListener("click", f);
}

export function registerJoinFormListener(f: Function) {
  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinForm.style.display = "none";
    const nameEle = <HTMLInputElement>document.getElementById("userName");
    const urlEle = <HTMLInputElement>document.getElementById("roomURL");
    f(nameEle.value, urlEle.value);
  });
}

export function updateCamBtn(camOn: boolean) {
  if (camOn && !toggleCamBtn.classList.contains("cam-on")) {
    toggleCamBtn.classList.remove("cam-off");
    toggleCamBtn.classList.add("cam-on");
  }
  if (!camOn && !toggleCamBtn.classList.contains("cam-off")) {
    toggleCamBtn.classList.remove("cam-on");
    toggleCamBtn.classList.add("cam-off");
  }
}

export function updateMicBtn(micOn: boolean) {
  if (micOn && !toggleMicBtn.classList.contains("mic-on")) {
    toggleMicBtn.classList.remove("mic-off");
    toggleMicBtn.classList.add("mic-on");
  }
  if (!micOn && !toggleMicBtn.classList.contains("mic-off")) {
    toggleMicBtn.classList.remove("mic-on");
    toggleMicBtn.classList.add("mic-off");
  }
}

export function showWorld() {
  const callDiv = document.getElementById("call");
  //const worldDiv = document.getElementById("world");
  const entryDiv = document.getElementById("entry");
  //  const controlsDiv = document.getElementById("controls");
  callDiv.style.display = "block";
  //  worldDiv.style.display = "inline-block";
  entryDiv.style.display = "none";
  // controlsDiv.style.display = "flex";
}

export function showJoinForm() {
  removeAllZonemates();
  stopBroadcast();

  const worldDiv = document.getElementById("world");
  const entryDiv = document.getElementById("entry");
  const controlsDiv = document.getElementById("controls");

  worldDiv.style.display = "none";
  entryDiv.style.display = "block";
  joinForm.style.display = "block";
  controlsDiv.style.display = "none";
}

export function showBroadcast(
  name: string,
  videoTrack?: MediaStreamTrack,
  audioTrack?: MediaStreamTrack
) {
  const tracks: Array<MediaStreamTrack> = [];
  if (videoTrack) tracks.push(videoTrack);
  if (audioTrack) tracks.push(audioTrack);
  if (tracks.length > 0) {
    broadcastVideo.srcObject = new MediaStream(tracks);
  }
  // Update name and show broadcast div
  broadcastName.innerText = name;
  broadcastDiv.style.visibility = "visible";
}

export function stopBroadcast() {
  console.log("Stopping broadcast");
  broadcastDiv.style.visibility = "hidden";
  broadcastVideo.srcObject = null;
}

export function showZonemate(
  sessionID: string,
  name: string,
  videoTrack?: MediaStreamTrack,
  audioTrack?: MediaStreamTrack
) {
  let zonemate = <HTMLDivElement>(
    document.getElementById(getZonemateTagID(sessionID))
  );
  if (!zonemate) {
    zonemate = createZonemate(sessionID, name);
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

function createZonemate(sessionID: string, name: string): HTMLDivElement {
  const zonemates = document.getElementById("zonemates");
  const zID = getZonemateTagID(sessionID);
  let zonemate = document.createElement("div");
  zonemate.id = zID;
  zonemate.className = "tile";
  zonemates.appendChild(zonemate);

  const nameTag = document.createElement("div");
  nameTag.innerText = name;
  nameTag.className = "name";
  zonemate.appendChild(nameTag);

  const vID = getVideoTagID(sessionID);
  const vid = document.createElement("video");
  vid.classList.add("fit");
  vid.autoplay = true;
  vid.id = vID;
  zonemate.appendChild(vid);
  return zonemate;
}

export function removeZonemate(sessionID: string) {
  const ele = document.getElementById(getZonemateTagID(sessionID));
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
