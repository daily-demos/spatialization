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
