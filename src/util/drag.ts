// drag.ts sets up draggable elements in our wrapper.
const wrapper = document.getElementById("focus");

// setupDraggableElement will ensure the wrapper is set up to allow drops,
// and add a listener to the given element to detect a drag being started.
export function setupDraggableElement(element: HTMLElement) {
  const dropSetupAttr = "dropSetupDone";
  if (!wrapper.getAttribute(dropSetupAttr)) {
    wrapper.addEventListener("drop", drop);
    wrapper.addEventListener("dragover", allowDrop);
    wrapper.setAttribute(dropSetupAttr, "true");
  }
  element.addEventListener("dragstart", drag);
}

// drop handles an element being dropped in another position on the wrapper
function drop(ev: DragEvent) {
  ev.preventDefault();
  const data = ev.dataTransfer.getData("targetID");
  const relativeMouseX = parseInt(ev.dataTransfer.getData("relativeMouseX"));
  const relativeMouseY = parseInt(ev.dataTransfer.getData("relativeMouseY"));

  // Offset the new position based on the relative position of the mouse
  // which we saved on drag start.
  let newTop = ev.clientY - relativeMouseY;
  let newLeft = ev.clientX - relativeMouseX;

  const ele = document.getElementById(data);
  ele.style.top = `${newTop}px`;
  ele.style.left = `${newLeft}px`;
  ele.style.position = "absolute";
}

function allowDrop(ev: Event) {
  ev.preventDefault();
}

function drag(ev: DragEvent) {
  const target = <HTMLElement>ev.target;
  ev.dataTransfer.setData("targetID", target.id);

  // Save the relative position of the mouse in relation to the element, to make sure
  // we drop it with the right offset at the end.
  const rect = target.getBoundingClientRect();
  ev.dataTransfer.setData(
    "relativeMouseX",
    (ev.clientX - rect.left).toString()
  );
  // 52 is the height of our Daily header.
  ev.dataTransfer.setData(
    "relativeMouseY",
    (ev.clientY - rect.top + 52).toString()
  );
}
