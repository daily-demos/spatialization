import { removeAllZonemates, stopBroadcast } from "./tile";

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
const toggleCamBtn = document.getElementById("toggleCam");
const toggleMicBtn = document.getElementById("toggleMic");
const toggleScreenBtn = <HTMLButtonElement>(
  document.getElementById("toggleScreenShare")
);

export function registerCamBtnListener(f: () => void) {
  toggleCamBtn.addEventListener("click", f);
}

export function registerMicBtnListener(f: () => void) {
  toggleMicBtn.addEventListener("click", f);
}

export function registerScreenShareBtnListener(f: () => void) {
  toggleScreenBtn.addEventListener("click", f);
}

export function registerLeaveBtnListener(f: () => void) {
  const leaveBtn = document.getElementById("leave");
  leaveBtn.addEventListener("click", f);
}

export function registerJoinFormListener(
  f: (name: string, url: string) => void
) {
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

export function updateScreenBtn(
  screenOn: boolean,
  disableBtn: boolean = false
) {
  if (screenOn && !toggleScreenBtn.classList.contains("screen-on")) {
    toggleScreenBtn.classList.remove("screen-off");
    toggleScreenBtn.classList.add("screen-on");
    return;
  }
  if (!screenOn && !toggleScreenBtn.classList.contains("screen-off")) {
    toggleScreenBtn.classList.remove("screen-on");
    toggleScreenBtn.classList.add("screen-off");
    if (disableBtn) {
      enableScreenBtn(!disableBtn);
    }
  }
}

export function enableScreenBtn(doEnable: boolean) {
  if (toggleScreenBtn.classList.contains("screen-on")) {
    console.warn(
      "Unable to disable screen button while user is sharing their screen"
    );
    return;
  }
  if (doEnable) {
    toggleScreenBtn.classList.remove("screen-disabled");
    toggleScreenBtn.disabled = false;
    return;
  }
  toggleScreenBtn.classList.add("screen-disabled");
  toggleScreenBtn.disabled = true;
}

export function showWorld() {
  const callDiv = document.getElementById("call");
  const entryDiv = document.getElementById("entry");
  callDiv.style.display = "block";
  entryDiv.style.display = "none";
}

export function showJoinForm() {
  removeAllZonemates();
  stopBroadcast();

  const entryDiv = document.getElementById("entry");
  const callDiv = document.getElementById("call");
  callDiv.style.display = "none";
  entryDiv.style.display = "block";
  joinForm.style.display = "block";
}
