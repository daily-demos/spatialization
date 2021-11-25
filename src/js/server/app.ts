import express from "express";
import { port } from "../env";
import { IRoom } from "../types";
import { getRoom, storeRoom } from "./cache";

var path = require("path");
const app = express();

app.get("/", (req, res) => {
  try {
    res.sendFile(path.resolve(__dirname + "/../../index.html"));
  } catch (e) {
    console.error("failed to serve index", e);
    return res.status(500);
  }
});

app.post("/specs/", (req, res) => {
  try {
    let room = <IRoom>req.body;
    storeRoom(room);
    return res.status(201);
  } catch (e) {
    console.error("failed to store room specs", e);
    return res.status(500);
  }
});

app.get("/specs/:room", async (req, res) => {
  try {
    let roomID = req.params.room;
    let room = await getRoom(roomID);
    return res.status(200).send(JSON.stringify(room));
  } catch (e) {
    console.error("failed to get room spes", e);
    return res.status(500);
  }
});

const start = (port: string) => {
  try {
    app.listen(port);
  } catch (err) {
    console.error(err);
    process.exit();
  }
};
start(port);
