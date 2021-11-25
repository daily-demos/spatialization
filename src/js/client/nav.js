const joinForm = document.getElementById("enterCall");
const createForm = document.getElementById("createCall");

export function registerCreateFormListener(f) {

}

export function registerJoinFormListener(f) {
  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    joinForm.style.display = "none";
    const urlEle = document.getElementById("roomURL");
    const nameEle = document.getElementById("userName");
    f(urlEle.value, nameEle.value);
  });
}

export function updateCallControls(joined) {
  const entry = document.getElementById("entry");
  const call = document.getElementById("call");
  // If the user has joined a call, remove the call entry form
  // and display the call controls. Otherwise, do the opposite.
  if (joined) {
    entry.style.display = "none";
    call.style.display = "inline-block";
  } else {
    entry.style.display = "inline-block";
    call.style.display = "none";
  }
}
