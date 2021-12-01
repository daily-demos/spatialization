export default class Socket {
  constructor() {
    this.connection = new WebSocket(`ws://${window.location.hostname}:1235`);
    this.connection.onerror = this.error;
  }
  
  send(message) {
    this.connection.send(JSON.stringify(message));
  }

  error(err) {
    console.log(err);
  }
}
