import setupDraggableElement from "./drag";

let broadcastName: HTMLDivElement;
let broadcastDiv: HTMLDivElement;
let broadcastVideo: HTMLVideoElement;

export function initBroadcastDOM() {
  broadcastName = <HTMLDivElement>document.getElementById("broadcastName");
  broadcastDiv = <HTMLDivElement>document.getElementById("broadcast");
  broadcastVideo = <HTMLVideoElement>document.getElementById("broadcastVideo");
  setupDraggableElement(broadcastDiv);
}

enum ZonemateTileKind {
  Screen = "screen",
  Camera = "camera",
}

// getErrUnrecognizedTileKind returns a consistent tile kind error for reuse
function getErrUnrecognizedTileKind(kind: ZonemateTileKind): string {
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

// showCamera shows a camera video tile in the zonemates div
export function showCamera(
  sessionID: string,
  name: string,
  videoTrack?: MediaStreamTrack,
  audioTrack?: MediaStreamTrack
) {
  const tracks: Array<MediaStreamTrack> = [];
  if (videoTrack) tracks.push(videoTrack);
  if (audioTrack) tracks.push(audioTrack);
  showZonemate(ZonemateTileKind.Camera, sessionID, name, tracks);
}

// showScreenShare shows a screen share video tile in the zonemates div
export function showScreenShare(
  sessionID: string,
  name: string,
  videoTrack?: MediaStreamTrack
) {
  const tracks: Array<MediaStreamTrack> = [];
  if (videoTrack) tracks.push(videoTrack);
  showZonemate(ZonemateTileKind.Screen, sessionID, name, tracks);
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

// showZonemate() shows either a camera or screen video tile for
// the given participants and tracks. It relies on the `kind`
// enum for a bit of screen or camera-specific behavior, but most
// of the logic is shared.
function showZonemate(
  kind: ZonemateTileKind,
  sessionID: string,
  name: string,
  tracks: MediaStreamTrack[]
) {
  let tileID: string;
  let videoTagID: string;
  if (kind === ZonemateTileKind.Camera) {
    tileID = getCameraTileID(sessionID);
    videoTagID = getCameraVidID(sessionID);
  } else if (kind === ZonemateTileKind.Screen) {
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

  const vid = <HTMLVideoElement>document.getElementById(videoTagID);
  if (tracks.length === 0) {
    vid.style.visibility = "hidden";
    return;
  }
  vid.style.visibility = "visible";
  vid.srcObject = new MediaStream(tracks);
}

// createZonemateTile creates a div containing a video tag and a name
// element for either a camera or screen share zonemate tile.
function createZonemateTile(
  kind: ZonemateTileKind,
  sessionID: string,
  name: string
): HTMLDivElement {
  const zonemates = document.getElementById("zonemates");
  let tileID;
  let vidID;
  let className: string;
  if (kind === ZonemateTileKind.Screen) {
    tileID = getScreenShareTileID(sessionID);
    vidID = getScreenShareVidID(sessionID);
    className = "contain";
  } else if (kind === ZonemateTileKind.Camera) {
    tileID = getCameraTileID(sessionID);
    vidID = getCameraVidID(sessionID);
    className = "fit";
  } else {
    console.error(getErrUnrecognizedTileKind(kind));
    return null;
  }

  const ele = document.createElement("div");
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
