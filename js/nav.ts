const joinForm = document.getElementById("enterCall");

export function registerCreateFormListener(f: Function) {}

export function registerJoinFormListener(f: Function) {
  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinForm.style.display = "none";
    const urlEle = <HTMLFormElement>document.getElementById("roomURL");
    const nameEle = <HTMLFormElement>document.getElementById("userName");
    f(urlEle.value, nameEle.value);
  });
}

export function updateCallControls(joined: boolean) {
  const entry = document.getElementById("entry");
  const room = document.getElementById("room");
  // If the user has joined a call, remove the call entry form
  // and display the call controls. Otherwise, do the opposite.
  if (joined) {
    entry.style.display = "none";
    room.style.display = "inline-block";
  } else {
    entry.style.display = "inline-block";
    room.style.display = "none";
  }
}
