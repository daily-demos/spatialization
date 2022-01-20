import {
  default as DailyIframe,
  DailyCall,
  DailyEventObjectAppMessage,
  DailyEventObjectParticipant,
  DailyParticipant,
  DailyEventObjectFatalError,
  DailyEventObjectNoPayload,
  DailyEventObjectCameraError,
  DailyEventObjectParticipants,
  DailyEventObjectNetworkConnectionEvent,
} from "@daily-co/daily-js";
import { globalZoneID, standardTileSize } from "./config";

import {
  registerCamBtnListener,
  registerLeaveBtnListener,
  registerMicBtnListener,
  showJoinForm,
  showWorld,
  updateCamBtn,
  updateMicBtn,
} from "./util/nav";
import { World } from "./world";
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

export class Room {
  url: string;
  userName: string;
  isGlobal: boolean;
  callObject: DailyCall;
  pendingAcks: { [key: string]: ReturnType<typeof setInterval> } = {};
  localBandwidthLevel = BandwidthLevel.Unknown;
  localState: State = { audio: null, video: null };
  topology: Topology;

  constructor(url: string, userName: string, isGlobal = false) {
    this.url = url;
    this.userName = userName;
    this.isGlobal = isGlobal;
    this.callObject = DailyIframe.createCallObject({
      subscribeToTracksAutomatically: false,
      dailyConfig: {
        experimentalChromeVideoMuteLightOff: true,
        camSimulcastEncodings: [{ maxBitrate: 600000, maxFramerate: 30 }],
      },
    })
      .on("camera-error", (e) => this.handleCameraError(e))
      .on("joined-meeting", (e) => this.handleJoinedMeeting(e))
      .on("left-meeting", (e) => this.handleLeftMeeting(e))
      .on("error", (e) => this.handleError(e))
      .on("participant-updated", (e) => this.handleParticipantUpdated(e))
      .on("participant-joined", (e) => this.handleParticipantJoined(e))
      .on("participant-left", (e) => this.handleParticipantLeft(e))
      .on("app-message", (e) => this.handleAppMessage(e))
      .on("network-connection", (e) => this.handleNetworkConnectionChanged(e));

    this.setBandwidth(BandwidthLevel.Tile);

    registerCamBtnListener(() => {
      const current = this.callObject.participants().local.video;
      this.callObject.setLocalVideo(!current);
    });

    registerMicBtnListener(() => {
      const current = this.callObject.participants().local.audio;
      console.log("toggling mic to:", !current);
      this.callObject.setLocalAudio(!current);
    });

    registerLeaveBtnListener(() => {
      this.callObject.leave();
      this.callObject.destroy();
      world.destroy();
      world = new World();
      showJoinForm();
    });
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
    for (const ack in this.pendingAcks) {
      clearInterval(this.pendingAcks[ack]);
    }
    this.pendingAcks = {};
  }

  private clearPendingAck(sessionID: string) {
    clearInterval(this.pendingAcks[sessionID]);
    delete this.pendingAcks[sessionID];
  }

  private setBandwidth(level: BandwidthLevel) {
    switch (level) {
      case BandwidthLevel.Tile:
        console.log("setting bandwidth to tile");
        this.localBandwidthLevel = level;
        const constraints = {
          width: standardTileSize,
          height: standardTileSize,
          frameRate: 15,
        };

        this.callObject.setBandwidth({
          trackConstraints: constraints,
        });
        break;
      case BandwidthLevel.Focus:
        console.log("setting bandwidth to focus");
        this.localBandwidthLevel = level;
        this.callObject.setBandwidth({
          trackConstraints: {
            width: 200,
            height: 200,
            frameRate: 30,
          },
        });
        break;
      default:
        console.warn(
          `setBandwidth called with unrecognized level (${level}). Not modifying any constraints.`
        );
    }
  }

  private updateLocal(p: DailyParticipant) {
    if (this.localState.audio != p.audio) {
      this.localState.audio = p.audio;
      updateMicBtn(this.localState.audio);
    }
    if (this.localState.video != p.video) {
      this.localState.video = p.video;
      updateCamBtn(this.localState.video);
    }
  }

  private handleCameraError(event: DailyEventObjectCameraError) {
    console.error(`camera error in room ${this.url}": ${event}`);
  }

  private handleError(event: DailyEventObjectFatalError) {
    console.error(`error in room ${this.url}": ${event}`);
  }

  private handleJoinedMeeting(event: DailyEventObjectParticipants) {
    const p = event.participants["local"];
    console.log(
      "JOINED MEETING. session ID, pID",
      p.session_id,
      p.user_id,
      this
    );
    const onCreateUser = () => {
      const tracks = this.getParticipantTracks(p);
      world.updateUser(p.session_id, p.user_name, tracks.video, tracks.audio);
    };

    const subToTracks = (sessionID: string) => {
      this.subToUserTracks(sessionID);
    };

    const unsubFromTracks = (sessionID: string) => {
      this.unsubFromUserTracks(sessionID);
    };

    const onMove = (pos: Pos, recipient: string = "*") => {
      const data = {
        action: "posChange",
        pos: pos,
      };
      this.broadcast(data, recipient);
    };

    const onJoinZone = (zoneData: ZoneData, recipient: string = "*") => {
      if (zoneData.zoneID === 0) {
        this.setBandwidth(BandwidthLevel.Tile);
      } else {
        this.setBandwidth(BandwidthLevel.Focus);
      }
      const data = {
        action: "zoneChange",
        zoneData: zoneData,
      };
      this.broadcast(data, recipient);
    };

    const onDataDump = (zoneData: ZoneData, posData: Pos, recipient: "*") => {
      const data = {
        action: "dump",
        pos: posData,
        zoneData: zoneData,
      };
      this.broadcast(data, recipient);
    };

    if (this.isGlobal) {
      const local = event.participants.local;
      showWorld();
      world.subToTracks = subToTracks;
      world.unsubFromTracks = unsubFromTracks;
      world.onCreateUser = onCreateUser;
      world.onMove = onMove;
      world.onJoinZone = onJoinZone;
      world.onDataDump = onDataDump;
      world.start();
      world.initLocalUser(local.session_id);
    }
  }

  private subToUserTracks(sessionID: string) {
    this.callObject.updateParticipant(sessionID, {
      setSubscribedTracks: { audio: true, video: true, screenVideo: false },
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
      case "dump":
        const pendingAck = this.pendingAcks[event.fromId];
        if (pendingAck) {
          this.clearPendingAck(event.fromId);
          world.sendDataDumpToParticipant(event.fromId);
        }
        world.updateParticipantZone(
          event.fromId,
          data.zoneData.zoneID,
          data.zoneData.spotID
        );
        if (data.zoneData.zoneID === globalZoneID) {
          world.updateParticipantPos(event.fromId, data.pos.x, data.pos.y);
        }
        break;
      case "zoneChange":
        world.updateParticipantZone(
          event.fromId,
          data.zoneData.zoneID,
          data.zoneData.spotID
        );
        break;
      case "posChange":
        world.updateParticipantPos(event.fromId, data.pos.x, data.pos.y);
        break;
    }
  }

  private handleLeftMeeting(event: DailyEventObjectNoPayload) {
    console.log("left meeting, reseting pending acks");
    this.resetPendingAcks();
  }

  private handleParticipantUpdated(event: DailyEventObjectParticipant) {
    const p = event.participant;
    const tracks = this.getParticipantTracks(p);
    world.updateUser(p.session_id, p.user_name, tracks.video, tracks.audio);
    if (p.session_id === this.callObject.participants()?.local?.session_id) {
      this.updateLocal(p);
    }
  }

  private handleParticipantJoined(event: DailyEventObjectParticipant) {
    const sID = event.participant.session_id;
    if (this.isRobot(event.participant.user_name)) {
      world.createRobot(sID);
      return;
    }
    world.initRemoteParticpant(sID, event.participant.user_name);
    world.sendZoneDataToParticipant(sID);
    world.sendPosDataToParticipant(sID);

    this.pendingAcks[sID] = setInterval(() => {
      if (!this.callObject.participants()[sID]) {
        this.clearPendingAck(sID);
        return;
      }
      world.sendDataDumpToParticipant(sID);
    }, 1000);
  }

  private isRobot(userName: string): Boolean {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
      userName
    );
  }

  private getParticipantTracks(participant: DailyParticipant) {
    const tracks = participant?.tracks;
    if (!tracks) return { video: null, audio: null };

    const vt = <{ [key: string]: any }>tracks.video;
    const at = <{ [key: string]: any }>tracks.audio;

    const videoTrack =
      vt?.state === playableState ? vt["persistentTrack"] : null;
    const audioTrack =
      at?.state === playableState ? at["persistentTrack"] : null;
    return {
      video: videoTrack,
      audio: audioTrack,
    };
  }

  private handleParticipantLeft(event: DailyEventObjectParticipant) {
    const up = event.participant;
    this.clearPendingAck(up.session_id);
    world.removeUser(up.session_id);
  }

  private handleNetworkConnectionChanged(
    event: DailyEventObjectNetworkConnectionEvent
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
    }
  }
}
