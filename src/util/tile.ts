import { setupDraggableElement } from "./drag";

const broadcastName = <HTMLDivElement>document.getElementById("broadcastName");
const broadcastDiv = <HTMLDivElement>document.getElementById("broadcast");
const broadcastVideo = <HTMLVideoElement>(
  document.getElementById("broadcastVideo")
);

setupDraggableElement(broadcastDiv);

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
  broadcastDiv.draggable = true;
}

export function stopBroadcast() {
  console.log("Stopping broadcast");
  broadcastDiv.style.visibility = "hidden";
  broadcastVideo.srcObject = null;
  broadcastDiv.draggable = false;
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
  zonemate.classList.add("tile");
  zonemate.classList.add("zonemate");
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
  zonemate.draggable = true;
  setupDraggableElement(zonemate);
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