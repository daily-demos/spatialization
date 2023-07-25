import DailyIframe, {
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEventObjectParticipant,
  DailyParticipant,
  DailyEventObjectFatalError,
  DailyEventObjectCameraError,
  DailyEventObjectParticipants,
  DailyEventObjectNetworkConnectionEvent,
  DailyRoomInfo,
  DailyEventObjectParticipantLeft,
} from "@daily-co/daily-js";
import { globalZoneID } from "./config";

import {
  enableScreenBtn,
  registerCamBtnListener,
  registerLeaveBtnListener,
  registerMicBtnListener,
  registerScreenShareBtnListener,
  showJoinForm,
  showWorld,
  updateCamBtn,
  updateMicBtn,
  updateScreenBtn,
} from "./util/nav";
import World from "./world";
import { Pos, ZoneData } from "./worldTypes";

const playableState = "playable";

let world = new World();

type BroadcastData = {
  action: string;
  zoneData?: ZoneData;
  pos?: Pos;
};

type State = {
  audio?: boolean;
  video?: boolean;
  screen?: boolean;
};

enum BandwidthLevel {
  Unknown = 0,
  Tile,
  Focus,
}

enum Topology {
  Unknown = 0,
  P2P,
  SFU,
}

export default class Room {
  url: string;

  userName: string;

  isGlobal: boolean;

  callObject: DailyCall;

  pendingAcks: { [key: string]: ReturnType<typeof setInterval> } = {};

  localState: State = { audio: null, video: null };

  topology: Topology;

  constructor(url: string, userName: string, isGlobal = false) {
    this.url = url;
    this.userName = userName;
    this.isGlobal = isGlobal;
    this.callObject = DailyIframe.createCallObject({
      subscribeToTracksAutomatically: false,
      sendSettings: {
        vieo: {
          // This is a temporary workaround until medium and high encodings become
          // optional in the next `daily-js` release:
          // @ts-ignore
          encodings: {
            low: {
              maxBitrate: 75000,
              scaleResolutionDownBy: 4,
              maxFramerate: 15,
            },
            medium: {
              maxBitrate: 300000,
              scaleResolutionDownBy: 2,
              maxFramerate: 30,
            },
          },
        },
      },
      dailyConfig: {
        avoidEval: true,
        userMediaVideoConstraints: {
          width: 400,
          height: 400,
        },
      },
    })
      .on("camera-error", (e) => this.handleCameraError(e))
      .on("joined-meeting", (e) => this.handleJoinedMeeting(e))
      .on("error", (e) => this.handleError(e))
      .on("participant-updated", (e) => this.handleParticipantUpdated(e))
      .on("participant-joined", (e) => this.handleParticipantJoined(e))
      .on("participant-left", (e) => this.handleParticipantLeft(e))
      .on("app-message", (e) => this.handleAppMessage(e))
      .on("network-connection", (e) => this.handleNetworkConnectionChanged(e));

    this.setBandwidth(BandwidthLevel.Tile);
  }

  async join() {
    try {
      await this.callObject.join({ url: this.url, userName: this.userName });
    } catch (e) {
      console.error(e);
      showJoinForm();
    }
  }

  broadcast(data: BroadcastData, recipientSessionID = "*") {
    this.callObject.sendAppMessage(data, recipientSessionID);
  }

  private resetPendingAcks() {
    Object.values(this.pendingAcks).forEach((ack) => {
      clearInterval(ack);
    });
    this.pendingAcks = {};
  }

  private clearPendingAck(sessionID: string) {
    clearInterval(this.pendingAcks[sessionID]);
    delete this.pendingAcks[sessionID];
  }

  private setBandwidth(level: BandwidthLevel) {
    switch (level) {
      case BandwidthLevel.Tile:
        this.callObject.updateSendSettings({
          video: {
            maxQuality: "low",
          },
        });
        break;
      case BandwidthLevel.Focus:
        this.callObject.updateSendSettings({
          video: {
            maxQuality: "medium",
          },
        });
        break;
      default:
        console.warn(
          `setBandwidth called with unrecognized level (${level}). Not modifying any constraints.`,
        );
    }
  }

  private updateLocal(p: DailyParticipant) {
    if (this.localState.audio !== p.audio) {
      this.localState.audio = p.audio;
      updateMicBtn(this.localState.audio);
    }
    if (this.localState.video !== p.video) {
      this.localState.video = p.video;
      updateCamBtn(this.localState.video);
    }
    if (this.localState.screen !== p.screen) {
      this.localState.screen = p.screen;
      updateScreenBtn(this.localState.screen);
    }
  }

  private handleCameraError(event: DailyEventObjectCameraError) {
    console.error(`camera error in room ${this.url}": ${event}`);
  }

  private handleError(event: DailyEventObjectFatalError) {
    console.error(`error in room ${this.url}": ${event}`);
  }

  private handleJoinedMeeting(event: DailyEventObjectParticipants) {
    // The world setup is only relevant for the global room,
    // since we can only have one world and one global room.
    if (!this.isGlobal) return;

    // Get the local participant
    const p = event.participants.local;

    registerCamBtnListener(() => {
      const current = this.callObject.participants().local.video;
      this.callObject.setLocalVideo(!current);
    });

    registerMicBtnListener(() => {
      const current = this.callObject.participants().local.audio;
      this.callObject.setLocalAudio(!current);
    });

    registerLeaveBtnListener(() => {
      this.resetPendingAcks();
      this.callObject.leave();
      this.callObject.destroy();
      world.destroy();
      world = new World();
      showJoinForm();
    });

    // Check if user's browser and current room meet requirements for
    // screen share support, and enable if so.
    this.maybeEnableScreenSharing();

    // Retrieve the video and audio tracks of this participant
    const tracks = getParticipantTracks(p);

    // The function World will use to instruct the room to
    // subscribe to another user's track.
    const subToTracks = (sessionID: string) => {
      this.subToUserTracks(sessionID);
    };

    // The function World will use to instruct the room to
    // unsubscribe from another user's track.
    const unsubFromTracks = (sessionID: string) => {
      this.unsubFromUserTracks(sessionID);
    };

    // The function World will call when the local user moves.
    // This will broadcast their new position to other participants.
    const onMove = (pos: Pos, recipient: string = "*") => {
      const data = {
        action: "posChange",
        pos,
      };
      this.broadcast(data, recipient);
    };

    // The function World will call when the local user changes zone.
    // This will update their bandwidth and broadcast their new zone
    // to other participants.
    const onJoinZone = (zoneData: ZoneData, recipient: string = "*") => {
      if (zoneData.zoneID === globalZoneID) {
        this.setBandwidth(BandwidthLevel.Tile);
        if (this.localState.screen) {
          this.stopScreenShare();
        }
        enableScreenBtn(false);
      } else {
        this.setBandwidth(BandwidthLevel.Focus);
        enableScreenBtn(true);
      }
      const data = {
        action: "zoneChange",
        zoneData,
      };
      this.broadcast(data, recipient);
    };

    // The function World will call to send a full data dump (position and zone)
    // to another participant. Happens when a new user first joins.
    const onDataDump = (zoneData: ZoneData, posData: Pos, recipient: "*") => {
      const data = {
        action: "dump",
        pos: posData,
        zoneData,
      };
      this.broadcast(data, recipient);
    };

    // Dispay the world DOM element.
    showWorld();

    // Configure the world with the callbacks we defined above
    world.subToTracks = subToTracks;
    world.unsubFromTracks = unsubFromTracks;
    world.onMove = onMove;
    world.onJoinZone = onJoinZone;
    world.onDataDump = onDataDump;

    // Start the world (begins update loop)
    world.start();

    // Create and initialize the local user.
    world.initLocalUser(p.session_id, tracks.video);
  }

  private maybeEnableScreenSharing() {
    // Retrieve our browser properties and check if screen sharing is possible
    const browserInfo = DailyIframe.supportedBrowser();
    if (!browserInfo.supportsScreenShare) return;

    // Retrieve our room properties and check if screen sharing is enabled
    this.callObject
      .room({ includeRoomConfigDefaults: true })
      .then((roomInfo) => {
        const info = roomInfo as DailyRoomInfo;
        // If screen sharing is disabled, early out
        if (!info || !info.config?.enable_screenshare) return;

        // If screen sharing is enabled, enable our screen share controls
        registerScreenShareBtnListener(() => {
          const isSharing = this.callObject.participants().local.screen;
          if (!isSharing) {
            this.startScreenShare();
            return;
          }
          this.stopScreenShare();
        });
      });
  }

  private subToUserTracks(sessionID: string) {
    this.callObject.updateParticipant(sessionID, {
      setSubscribedTracks: { audio: true, video: true, screenVideo: true },
    });
  }

  private unsubFromUserTracks(sessionID: string) {
    // Unsubscriptions are not supported in peer-to-peer  mode. Attempting
    // to unsubscribe in P2P mode will silently fail, so let's not even try.
    if (this.topology !== Topology.SFU) return;

    this.callObject.updateParticipant(sessionID, {
      setSubscribedTracks: { audio: false, video: false, screenVideo: false },
    });
  }

  private handleAppMessage(event: DailyEventObjectAppMessage) {
    const data = <BroadcastData>event.data;
    const msgType = data.action;
    switch (msgType) {
      case "posChange":
        world.updateParticipantPos(event.fromId, data.pos.x, data.pos.y);
        break;
      case "zoneChange":
        world.updateParticipantZone(
          event.fromId,
          data.zoneData.zoneID,
          data.zoneData.spotID,
        );
        break;
      case "dump":
        this.broadcast({ action: "ack" }, event.fromId);

        world.updateParticipantZone(
          event.fromId,
          data.zoneData.zoneID,
          data.zoneData.spotID,
        );
        if (data.zoneData.zoneID === globalZoneID) {
          world.updateParticipantPos(event.fromId, data.pos.x, data.pos.y);
        }
        break;
      case "ack": {
        console.log(`Received acknowledgement from ${event.fromId}`);
        const pendingAck = this.pendingAcks[event.fromId];
        if (pendingAck) {
          this.clearPendingAck(event.fromId);
        }
        break;
      }
      default:
        console.warn("Received unrecognized app message received", data);
        break;
    }
  }

  private handleParticipantUpdated(event: DailyEventObjectParticipant) {
    const p = event.participant;
    const tracks = getParticipantTracks(p);
    world.updateUser(
      p.session_id,
      p.user_name,
      tracks.video,
      tracks.audio,
      tracks.screen,
    );
    if (p.session_id === this.callObject.participants()?.local?.session_id) {
      this.updateLocal(p);
    }
  }

  private handleParticipantJoined(event: DailyEventObjectParticipant) {
    const sID = event.participant.session_id;
    if (isRobot(event.participant.user_name)) {
      world.createRobot(sID);
      return;
    }
    world.initRemoteParticipant(sID, event.participant.user_name);

    this.pendingAcks[sID] = setInterval(() => {
      if (!this.callObject.participants()[sID]) {
        this.clearPendingAck(sID);
        return;
      }
      world.sendDataDumpToParticipant(sID);
    }, 1000);
  }

  private handleParticipantLeft(event: DailyEventObjectParticipantLeft) {
    const up = event.participant;
    this.clearPendingAck(up.session_id);
    world.removeUser(up.session_id);
  }

  private handleNetworkConnectionChanged(
    event: DailyEventObjectNetworkConnectionEvent,
  ) {
    if (event.event !== "connected") return;
    console.log("Network connection changed. Type:", event.type);
    switch (event.type) {
      case "peer-to-peer":
        this.topology = Topology.P2P;
        break;
      case "sfu":
        this.topology = Topology.SFU;
        break;
      default:
        console.warn("Unrecognized network connection type", event.type);
        break;
    }
  }

  private async startScreenShare() {
    let captureStream = null;
    const options = {
      video: true,
    };

    try {
      captureStream = await navigator.mediaDevices.getDisplayMedia(options);
    } catch (err) {
      console.error(`Failed to get display media: ${err}`);
    }
    if (captureStream) {
      this.callObject.startScreenShare({ mediaStream: captureStream });
    }
  }

  private stopScreenShare() {
    this.callObject.stopScreenShare();
    // The above call performs relevant cleanup and ensures
    // associated events get fired, BUT daily-js only calls
    // stop() on daily-managed tracks. Since we got our screen
    // track ourselves, we must call stop on it manually.
    this.callObject
      .participants()
      .local.tracks?.screenVideo?.persistentTrack?.stop();
  }
}

function isRobot(userName: string): Boolean {
  return /^[a-zA-Z]{2}-[a-zA-Z0-9-]+-[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(
    userName,
  );
}

function getParticipantTracks(participant: DailyParticipant) {
  const tracks = participant?.tracks;
  if (!tracks) return { video: null, audio: null, screen: null };

  const vt = <{ [key: string]: any }>tracks.video;
  const at = <{ [key: string]: any }>tracks.audio;
  const st = <{ [key: string]: any }>tracks.screenVideo;

  const videoTrack = vt?.state === playableState ? vt.persistentTrack : null;
  const audioTrack = at?.state === playableState ? at.persistentTrack : null;
  const screenTrack = st?.state === playableState ? st.persistentTrack : null;

  return {
    video: videoTrack,
    audio: audioTrack,
    screen: screenTrack,
  };
}
