import { setupDraggableElement } from "./drag";

const broadcastName = <HTMLDivElement>document.getElementById("broadcastName");
const broadcastDiv = <HTMLDivElement>document.getElementById("broadcast");
const broadcastVideo = <HTMLVideoElement>(
  document.getElementById("broadcastVideo")
);
setupDraggableElement(broadcastDiv);

enum zonemateTileKind {
  Screen = "screen",
  Camera = "camera",
}

function getErrUnrecognizedTileKind(kind: zonemateTileKind): string {
  return `unrecognized zonemate tile kind: ${kind}`;
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
  broadcastDiv.draggable = true;
}

export function stopBroadcast() {
  broadcastDiv.style.visibility = "hidden";
  broadcastVideo.srcObject = null;
  broadcastDiv.draggable = false;
}

function showZonemate(
  kind: zonemateTileKind,
  sessionID: string,
  name: string,
  tracks: MediaStreamTrack[]
) {
  let tileID: string;
  let videoTagID: string;
  if (kind === zonemateTileKind.Camera) {
    tileID = getCameraTileID(sessionID);
    videoTagID = getCameraVidID(sessionID);
  } else if (kind === zonemateTileKind.Screen) {
    tileID = getScreenShareTileID(sessionID);
    videoTagID = getScreenShareVidID(sessionID);
  } else {
    console.error(getErrUnrecognizedTileKind(kind));
    return;
  }
  let zonemate = <HTMLDivElement>document.getElementById(tileID);
  if (!zonemate) {
    zonemate = createZonemateTile(kind, sessionID, name);
  }

  if (tracks.length === 0) {
    return;
  }

  const vid = <HTMLVideoElement>document.getElementById(videoTagID);
  vid.srcObject = new MediaStream(tracks);
}

export function showCamera(
  sessionID: string,
  name: string,
  videoTrack?: MediaStreamTrack,
  audioTrack?: MediaStreamTrack
) {
  const tracks: Array<MediaStreamTrack> = [];
  if (videoTrack) tracks.push(videoTrack);
  if (audioTrack) tracks.push(audioTrack);
  showZonemate(zonemateTileKind.Camera, sessionID, name, tracks);
}

export function showScreenShare(
  sessionID: string,
  name: string,
  videoTrack?: MediaStreamTrack
) {
  const tracks: Array<MediaStreamTrack> = [];
  if (videoTrack) tracks.push(videoTrack);
  showZonemate(zonemateTileKind.Screen, sessionID, name, tracks);
}

export function removeCamera(sessionID: string) {
  const ele = document.getElementById(getCameraTileID(sessionID));
  if (ele) ele.remove();
}

export function removeAllZonemates() {
  const zonemates = document.getElementById("zonemates");
  zonemates.textContent = "";
}

export function removeScreenShare(sessionID: string) {
  const ele = document.getElementById(getScreenShareTileID(sessionID));
  if (ele) ele.remove();
}

function createZonemateTile(
  kind: zonemateTileKind,
  sessionID: string,
  name: string
) {
  const zonemates = document.getElementById("zonemates");
  let tileID, vidID, className: string;
  if (kind === zonemateTileKind.Screen) {
    tileID = getScreenShareTileID(sessionID);
    vidID = getScreenShareVidID(sessionID);
    className = "contain";
  } else if (kind === zonemateTileKind.Camera) {
    tileID = getCameraTileID(sessionID);
    vidID = getCameraVidID(sessionID);
    className = "fit";
  } else {
    console.error(getErrUnrecognizedTileKind(kind));
    return;
  }

  let ele = document.createElement("div");
  ele.id = tileID;
  ele.classList.add(kind.toString());
  zonemates.appendChild(ele);

  const vid = document.createElement("video");
  vid.autoplay = true;
  vid.id = vidID;
  vid.classList.add(className);
  ele.appendChild(vid);
  ele.draggable = true;

  const nameTag = document.createElement("div");
  nameTag.innerText = name;
  nameTag.className = "name";
  ele.appendChild(nameTag);

  setupDraggableElement(ele);
  return ele;
}

function getCameraTileID(sessionID: string): string {
  return `camera-tile-${sessionID}`;
}

function getCameraVidID(sessionID: string): string {
  return `camera-vid-${sessionID}`;
}

function getScreenShareTileID(sessionID: string): string {
  return `screen-tile-${sessionID}`;
}

function getScreenShareVidID(sessionID: string): string {
  return `screen-vid-${sessionID}`;
}
