
export default class KeyListener {
  constructor() {
    this.pressedKeys  = {};
  }

  on(key, f) {
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
    }
  }
}

const joinForm = document.getElementById("enterCall");
const nav = document.getElementById("nav");

export function registerJoinFormListener(f) {
  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinForm.style.display = "none";
    const nameEle = document.getElementById("userName");
    f(nameEle.value);
  });
}

export function showWorld() {
  const worldDiv = document.getElementById("world");
  const entryDiv = document.getElementById("entry");
  worldDiv.style.display = "block";
  entryDiv.style.display = "none";
}