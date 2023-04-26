import "./env";
import Room from "./room";
import { registerJoinFormListener } from "./util/nav";

// These imports are here to ensure they're bundled into
// the final distribution.
import "./index.html";
import "./style.css";
import "./assets/favicon.ico";
import "./assets/daily.svg";
import "./assets/github.png";
import "./assets/camera-off.svg";
import "./assets/camera.svg";
import "./assets/microphone-off.svg";
import "./assets/microphone.svg";
import "./assets/screen-off.svg";
import "./assets/screen-on.svg";

const globalRoom = new Room();

setupDeviceSelection();

registerJoinFormListener(initCall);

export default function initCall(name: string, url: string) {
  // We will do this in rooms, in case we want to implement
  // breakout rooms later. Each room will have its own instance of
  // the daily call object. There is one "global" room. Note that Daily
  // only supports one call object instance at a time.
  globalRoom.join(url, name, true);
}

// setupDeviceSelection initializes device selection dropdowns
// and sets up relevant change listeners.
function setupDeviceSelection() {
  const { callObject } = globalRoom;

  // Get the mic dropdown and register what happens
  // when selection changes
  const mics = getMicDropdown();
  mics.onchange = () => {
    const deviceId = mics.selectedOptions[0].value;
    switchMicrophone(deviceId);
  };

  // Get the cam dropdown and register what happens
  // when selection changes
  const cams = getCamDropdown();
  cams.onchange = () => {
    const deviceId = cams.selectedOptions[0].value;
    switchCamera(deviceId);
  };

  // The following call will request device permissions
  // if we don't already have them.
  callObject.startCamera();
  // Enumerate all acccessible devices and update selection dropdowns
  callObject.enumerateDevices().then((devices) => {
    updateDeviceSelection(devices);
  });

  // Set up device change listener, for handling newly plugged in
  // or removed devices.
  navigator.mediaDevices.addEventListener("devicechange", () => {
    callObject.enumerateDevices().then((devices) => {
      updateDeviceSelection(devices);
    });
  });
}

// updateDeviceSelection() refreshes the cam and mic selection
// dropdowns with a new device list.
function updateDeviceSelection(devices: { devices: MediaDeviceInfo[] }) {
  // Reset device lists
  const mics = getMicDropdown();
  mics.innerHTML = null;

  const cams = getCamDropdown();
  cams.innerHTML = null;

  const d = devices.devices;

  // Iterate through all available devices
  for (let i = 0; i < d.length; i += 1) {
    const device = d[i];
    const { kind } = device;
    const opt = new Option(device.label, device.deviceId);
    if (kind === "audioinput") {
      mics.appendChild(opt);
    } else if (kind === "videoinput") {
      cams.appendChild(opt);
    }
  }
}
// switchCamera() tells Daily to use the given
// camera device ID
async function switchCamera(deviceId: string) {
  console.log(`Switching camera to ${deviceId}`);
  globalRoom.callObject.setInputDevicesAsync({
    videoDeviceId: deviceId,
  });
}

// switchMicrophone tells Daily to use the given
// microphone device ID
async function switchMicrophone(deviceId: string) {
  console.log(`Switching microphone to ${deviceId}`);
  globalRoom.callObject.setInputDevicesAsync({
    audioDeviceId: deviceId,
  });
}

function getCamDropdown(): HTMLSelectElement {
  return <HTMLSelectElement>document.getElementById("cam-select");
}

function getMicDropdown(): HTMLSelectElement {
  return <HTMLSelectElement>document.getElementById("mic-select");
}
