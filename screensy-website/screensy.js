/**
 * @source  ./screensy.ts
 *
 * @licstart  The following is the entire license notice for the JavaScript
 * code in this page.
 *
 * Copyright (C) 2021  Stef Gijsberts, Marijn van Wezel
 *
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU General Public License (GNU GPL)
 * as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
 *
 * As additional permission under GNU GPL version 3 section 7, you may
 * distribute non-source (e.g., minimized or compacted) forms of that code
 * without the copy of the GNU GPL normally required by section 4, provided you
 * include this license notice and a URL through which recipients can access
 * the Corresponding Source.
 *
 * @licend  The above is the entire license notice for the JavaScript code in
 * this page.
 */
/**
 * Pause execution until the listener/event has fired on the given target.
 *
 * @see https://stackoverflow.com/a/63718685
 */
function wait(target, listenerName) {
    // Lambda that returns a listener for the given resolve lambda
    const listener = (resolve) => (event) => {
        target.removeEventListener(listenerName, listener(resolve));
        resolve(event);
    };
    return new Promise((resolve, _reject) => {
        target.addEventListener(listenerName, listener(resolve));
    });
}
/**
 * Displays the popup with the given name. Does nothing if the popup does not
 * exist.
 *
 * @param name Name of the popup to display
 */
function showPopup(name) {
    const element = document.getElementById(name);
    if (element == null) {
        return;
    }
    element.classList.remove("hidden");
}
/**
 * Hides the popup with the given name. Does nothing if the popup is not visible or if
 * the popup does not exist.
 *
 * @param name Name of the popup to hide
 */
function hidePopup(name) {
    const element = document.getElementById(name);
    if (element == null) {
        return;
    }
    element.classList.add("hidden");
}
/**
 * Represents a broadcaster. The broadcaster is responsible for capturing and sending
 * their screen (and maybe audio) to all peers.
 */
class Broadcaster {
    /**
     * Broadcaster constructor.
     *
     * @param sendMessage Function to send a message to the server
     * @param rtcConfig The WebRTC configuration to use for the WebRTC connection
     * @param mediaStream The MediaStream to broadcast
     */
    constructor(sendMessage, rtcConfig, mediaStream) {
        this.onviewerjoin = null;
        this.onviewerleave = null;
        this.viewers = {};
        this.sendMessage = sendMessage;
        this.rtcConfig = rtcConfig;
        this.mediaStream = mediaStream;
    }
    /**
     * @inheritDoc
     */
    async handleMessage(msg) {
        switch (msg.type) {
            case "viewer":
                await this.addViewer(msg.viewerId);
                break;
            case "viewerdisconnected":
                await this.removeViewer(msg.viewerId);
                break;
            case "webrtcbroadcaster":
                await this.handleWebRTCMessage(msg);
                break;
        }
    }
    /**
     * Adds a viewer to the peer-to-peer connection.
     *
     * @param viewerId
     * @private
     */
    async addViewer(viewerId) {
        const viewerConnection = new RTCPeerConnection(this.rtcConfig);
        for (const track of await this.mediaStream.getTracks()) {
            viewerConnection.addTrack(track, this.mediaStream);
        }
        viewerConnection.onicecandidate = (event) => {
            if (!event.candidate)
                return;
            this.sendMessage({
                type: "webrtcbroadcaster",
                kind: "candidate",
                viewerId: viewerId,
                message: event.candidate,
            });
        };
        viewerConnection.onicegatheringstatechange = async (_event) => {
            if (viewerConnection.iceGatheringState !== "complete") {
                return;
            }
            for (const sender of await viewerConnection.getSenders()) {
                if (sender.track == null) {
                    continue;
                }
                const rtcSendParameters = sender.getParameters();
                // https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters#currently_compatible_implementation
                if (!rtcSendParameters.encodings) {
                    rtcSendParameters.encodings = [{}];
                }
                if (sender.track.kind === "audio") {
                    rtcSendParameters.encodings[0].maxBitrate = 960000; // 960 Kbps, does gek
                }
                else if (sender.track.kind === "video") {
                    // @ts-ignore
                    rtcSendParameters.encodings[0].maxFramerate = 30;
                    rtcSendParameters.encodings[0].maxBitrate = 100000000; // 100 Mbps
                }
                await sender.setParameters(rtcSendParameters);
            }
        };
        const offer = await viewerConnection.createOffer();
        await viewerConnection.setLocalDescription(offer);
        const localDescription = viewerConnection.localDescription;
        if (localDescription == null) {
            throw "No local description available.";
        }
        await this.sendMessage({
            type: "webrtcbroadcaster",
            kind: "offer",
            viewerId: viewerId,
            message: localDescription,
        });
        this.viewers[viewerId] = viewerConnection;
        if (this.onviewerjoin != null) {
            this.onviewerjoin(viewerId);
        }
    }
    /**
     * Removes a viewer from the peer-to-peer connection.
     *
     * @param viewerId
     * @private
     */
    async removeViewer(viewerId) {
        if (this.viewers[viewerId] == null) {
            return;
        }
        this.viewers[viewerId].close();
        delete this.viewers[viewerId];
        if (this.onviewerleave != null) {
            this.onviewerleave(viewerId);
        }
    }
    /**
     * Handles incoming WebRTC messages.
     *
     * @param msg
     * @private
     */
    async handleWebRTCMessage(msg) {
        const kind = msg.kind;
        switch (kind) {
            case "candidate":
                if (this.viewers[msg.viewerId] == null) {
                    break;
                }
                await this.viewers[msg.viewerId].addIceCandidate(new RTCIceCandidate(msg.message));
                break;
            case "answer":
                if (this.viewers[msg.viewerId] == null) {
                    break;
                }
                await this.viewers[msg.viewerId].setRemoteDescription(msg.message);
                break;
        }
    }
}
/**
 * Represents a viewer.
 */
class Viewer {
    /**
     * Viewer constructor.
     *
     * @param sendMessage Function to send a message to the server
     * @param rtcConfig The WebRTC configuration to use for the WebRTC connection
     * @param videoElement The element to project the received MediaStream onto
     */
    constructor(sendMessage, rtcConfig, videoElement) {
        this.broadcasterPeerConnection = null;
        this.sendMessage = sendMessage;
        this.rtcConfig = rtcConfig;
        this.videoElement = videoElement;
    }
    /**
     * @inheritDoc
     */
    async handleMessage(msg) {
        switch (msg.type) {
            case "broadcasterdisconnected":
                await this.handleBroadcasterDisconnect();
                break;
            case "webrtcviewer":
                await this.handleWebRTCMessage(msg);
                break;
        }
    }
    /**
     * Handles a disconnect of the broadcaster.
     *
     * @private
     */
    async handleBroadcasterDisconnect() {
        showPopup("broadcaster-disconnected");
        document.body.removeChild(this.videoElement);
    }
    /**
     * Handles incoming WebRTC messages.
     *
     * @param msg
     * @private
     */
    async handleWebRTCMessage(msg) {
        const kind = msg.kind;
        switch (kind) {
            case "candidate":
                if (this.broadcasterPeerConnection == null) {
                    break;
                }
                await this.broadcasterPeerConnection.addIceCandidate(new RTCIceCandidate(msg.message));
                break;
            case "offer":
                await this.handleOffer(msg);
                break;
        }
    }
    /**
     * Handles incoming WebRTC offer.
     *
     * @param msg
     * @private
     */
    async handleOffer(msg) {
        this.broadcasterPeerConnection = new RTCPeerConnection(this.rtcConfig);
        this.broadcasterPeerConnection.ontrack = (event) => {
            this.videoElement.srcObject = event.streams[0];
        };
        this.broadcasterPeerConnection.onicecandidate = (event) => {
            if (event.candidate == null)
                return;
            this.sendMessage({
                type: "webrtcviewer",
                kind: "candidate",
                message: event.candidate,
            });
        };
        await this.broadcasterPeerConnection.setRemoteDescription(msg.message);
        const answer = await this.broadcasterPeerConnection.createAnswer();
        await this.broadcasterPeerConnection.setLocalDescription(answer);
        if (this.broadcasterPeerConnection == null) {
            throw "No local description available.";
        }
        await this.sendMessage({
            type: "webrtcviewer",
            kind: "answer",
            message: this.broadcasterPeerConnection.localDescription,
        });
    }
}
class Room {
    /**
     * Room constructor.
     *
     * @param roomId The ID of this room
     */
    constructor(roomId) {
        this.roomId = roomId;
        this.videoElement = document.getElementById("stream");
        const webSocketProtocol = window.location.protocol === "http" ? "ws" : "wss";
        const webSocketUrl = webSocketProtocol + "://10.0.1.216:4000/";
        this.webSocket = new WebSocket(webSocketUrl);
        this.webSocket.onerror = () => showPopup("websocket-connect-failed");
        this.sendMessage = async (message) => this.webSocket.send(JSON.stringify(message));
        this.rtcConfig = {
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
            ],
            iceCandidatePoolSize: 8,
        };
        this.videoElement.onpause = (_event) => this.videoElement.play();
        window.onunload = window.onbeforeunload = () => this.webSocket.close();
    }
    /**
     * Joins the room.
     */
    async join() {
        // Wait until the socket opens
        await wait(this.webSocket, "open");
        this.webSocket.onmessage = async (event) => {
            const messageData = JSON.parse(event.data);
            const isBroadcaster = messageData.type === "broadcast";
            if (isBroadcaster &&
                !("getDisplayMedia" in navigator.mediaDevices)) {
                showPopup("screensharing-not-supported");
                return;
            }
            const client = isBroadcaster
                ? await this.setupBroadcaster()
                : await this.setupViewer();
            this.webSocket.onmessage = (event) => client.handleMessage(JSON.parse(event.data));
            if (isBroadcaster) {
                await this.sendMessage({ type: "requestviewers" });
            }
            this.setDocumentTitle();
        };
        await this.sendMessage({
            type: "join",
            roomId: this.roomId.toLowerCase(),
        });
    }
    /**
     * Sets the document's title to the room name.
     */
    setDocumentTitle() {
        const roomIdWords = this.roomId.split(/(?=[A-Z])/);
        document.title = roomIdWords.join(" ") + " | screensy";
    }
    /**
     * Set up a Broadcaster instance.
     */
    async setupBroadcaster() {
        const mediaStream = await this.getDisplayMediaStream();
        const broadcaster = new Broadcaster(this.sendMessage, this.rtcConfig, mediaStream);
        const counterElement = document.createElement("p");
        counterElement.id = "counter";
        counterElement.innerText = "0";
        broadcaster.onviewerjoin = (_viewerId) => {
            const currentCounter = parseInt(counterElement.innerText);
            counterElement.innerText = (currentCounter + 1).toString();
        };
        broadcaster.onviewerleave = (_viewerId) => {
            const currentCounter = parseInt(counterElement.innerText);
            counterElement.innerText = (currentCounter - 1).toString();
        };
        document.body.prepend(counterElement);
        this.videoElement.srcObject = mediaStream;
        return broadcaster;
    }
    /**
     * Set up a Viewer instance.
     */
    async setupViewer() {
        // The client is assigned the role of viewer
        return new Viewer(this.sendMessage, this.rtcConfig, this.videoElement);
    }
    /**
     * Returns the user's display MediaStream.
     *
     * @private
     */
    async getDisplayMediaStream() {
        showPopup("click-to-share");
        await wait(document, "click");
        const videoConstraints = true;
        const audioConstraints = {
            channelCount: { ideal: 2 },
            sampleRate: { ideal: 192000 },
            // @ts-ignore
            noiseSuppression: { ideal: false },
            echoCancellation: { ideal: false },
            autoGainControl: { ideal: false },
        };
        const mediaConstraints = {
            video: videoConstraints,
            audio: audioConstraints,
        };
        const mediaDevices = window.navigator.mediaDevices;
        // @ts-ignore getDisplayMedia is not supported by TypeScript :(
        const displayMedia = mediaDevices.getDisplayMedia(mediaConstraints);
        // If the promise is resolved, remove the popup from the screen
        displayMedia.then(() => {
            hidePopup("click-to-share");
        });
        // If the promise is rejected, tell the user about the failure
        displayMedia.catch(() => {
            hidePopup("click-to-share");
            showPopup("access-denied");
        });
        return displayMedia;
    }
}
/**
 * Generates a random readable room name and returns the words as a string array.
 *
 * @source https://github.com/jitsi/js-utils/blob/master/random/roomNameGenerator.js
 */
function generateRoomName() {
    const adjectives = [
        "large",
        "small",
        "beautiful",
        "heavenly",
        "red",
        "yellow",
        "green",
        "orange",
        "purple",
        "massive",
        "tasty",
        "cheap",
        "fancy",
        "expensive",
        "crazy",
        "round",
        "triangular",
        "powered",
        "blue",
        "heavy",
        "square",
        "rectangular",
        "lit",
        "authentic",
        "broken",
        "busy",
        "original",
        "special",
        "thick",
        "thin",
        "pleasant",
        "sharp",
        "steady",
        "happy",
        "delighted",
        "stunning",
    ];
    const pluralNouns = [
        "monsters",
        "people",
        "cars",
        "buttons",
        "vegetables",
        "students",
        "computers",
        "robots",
        "lamps",
        "doors",
        "wizards",
        "books",
        "shirts",
        "pens",
        "guitars",
        "bottles",
        "microphones",
        "pants",
        "drums",
        "plants",
        "batteries",
        "barrels",
        "birds",
        "coins",
        "clothes",
        "deals",
        "crosses",
        "devices",
        "desktops",
        "diamonds",
        "fireworks",
        "funds",
        "guitars",
        "pianos",
        "harmonies",
        "levels",
        "mayors",
        "mechanics",
        "networks",
        "ponds",
        "trees",
        "proofs",
        "flowers",
        "houses",
        "speakers",
        "phones",
        "chargers",
    ];
    const verbs = [
        "break",
        "roll",
        "flip",
        "grow",
        "bake",
        "create",
        "cook",
        "smack",
        "drink",
        "close",
        "display",
        "run",
        "move",
        "flop",
        "wrap",
        "enter",
        "dig",
        "fly",
        "swim",
        "draw",
        "celebrate",
        "communicate",
        "encompass",
        "forgive",
        "negotiate",
        "pioneer",
        "photograph",
        "play",
        "scratch",
        "stabilize",
        "weigh",
        "wrap",
        "yield",
        "return",
        "update",
        "understand",
        "propose",
        "succeed",
        "stretch",
        "submit",
    ];
    const adverbs = [
        "gingerly",
        "thoroughly",
        "heavily",
        "crazily",
        "mostly",
        "fast",
        "slowly",
        "merrily",
        "quickly",
        "heavenly",
        "cheerfully",
        "honestly",
        "politely",
        "bravely",
        "vivaciously",
        "fortunately",
        "innocently",
        "kindly",
        "eagerly",
        "elegantly",
        "vividly",
        "reasonably",
        "rudely",
        "wisely",
        "thankfully",
        "wholly",
        "adorably",
        "happily",
        "firmly",
        "fast",
        "simply",
        "wickedly",
    ];
    const idxAdjective = Math.floor(Math.random() * adjectives.length);
    const idxPluralNoun = Math.floor(Math.random() * pluralNouns.length);
    const idxVerb = Math.floor(Math.random() * verbs.length);
    const idxAdverb = Math.floor(Math.random() * adverbs.length);
    const words = [
        adjectives[idxAdjective],
        pluralNouns[idxPluralNoun],
        verbs[idxVerb],
        adverbs[idxAdverb],
    ];
    // @see https://flaviocopes.com/how-to-uppercase-first-letter-javascript/
    return words
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
}
async function main(_event) {
    if (window.location.hash == "") {
        // Redirect the user to a room
        window.location.replace("#" + generateRoomName());
    }
    // If the user manually changes the hash, force a reload
    window.onhashchange = (_event) => {
        location.reload();
    };
    if (!("WebSocket" in window)) {
        showPopup("websockets-not-supported");
        return;
    }
    if (!("mediaDevices" in navigator)) {
        showPopup("mediastream-not-supported");
        return;
    }
    if (!("RTCPeerConnection" in window)) {
        showPopup("webrtc-not-supported");
        return;
    }
    const room = new Room(window.location.hash.substring(1));
    await room.join();
}
window.addEventListener("DOMContentLoaded", main);
