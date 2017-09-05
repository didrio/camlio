"use strict";

var socketUrl = "https://caml.io",
    isChannelReady = false,
    isInitiator = false,
    isStarted = false,
    faceDetected = false,
    localStream,
    pc,
    dataChannel,
    submitButton = document.getElementById("submit"),
    rerollButton = document.getElementById("reroll"),
    textArea = document.getElementById("text-area"),
    textFrom = document.getElementById("text-from"),
    counterElement = document.getElementById("counter"),
    onlineUsers = document.getElementById("online-users"),
    firstWarning = document.getElementById("first-warning"),
    warning = document.getElementById("warning"),
    remoteVideo = document.querySelector("#remoteVideo"),
    counter = 10,
    timeout,
    interval,
    tracker,
    socket;

var configuration = { iceServers: [
  {
    urls: "turn:numb.viagenie.ca",
    credential: "muazkh",
    username: "webrtc@live.com"
  },
  {
    urls: "turn:turn.anyfirewall.com:443?transport=tcp",
    credential: "webrtc",
    username: "webrtc"
  },
  {
    urls: "turn:192.158.29.39:3478?transport=udp",
    credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
    username: "28224511:1379330808"
  },
  {
    urls: "turn:192.158.29.39:3478?transport=tcp",
    credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
    username: "28224511:1379330808"
  },
  {
    urls: "stun:stun.services.mozilla.com",
    username: "louis@mozilla.com",
    credential: "webrtcdemo"
  }, {
    urls: [
          "stun:stun01.sipphone.com",
          "stun:stun.ekiga.net",
          "stun:stun.fwdnet.net",
          "stun:stun.ideasip.com",
          "stun:stun.iptel.org",
          "stun:stun.rixtelecom.se",
          "stun:stun.schlund.de",
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
          "stun:stunserver.org",
          "stun:stun.softjoys.com",
          "stun:stun.voiparound.com",
          "stun:stun.voipbuster.com",
          "stun:stun.voipstunt.com",
          "stun:stun.voxgratia.org",
          "stun:stun.xten.com"
    ]
  }]
};

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(stream => {
  localStream = stream;
  document.querySelector("#trackingVideo").srcObject = stream;
  setupTracker();
})
.catch(error => {
  alert("There was an error getting the stream.");
});

function startSession() {
  firstWarning.style.display = "none";
  window.onbeforeunload = () => {
    sendMessage("bye");
  };
  rerollButton.addEventListener("click", event => {
    sendMessage("bye");
    reroll();
  });
  submitButton.addEventListener("click", event => {
    if (dataChannel) {
      dataChannel.send(textArea.value);
      textFrom.innerHTML += "<div class='text-line'><span class='you-text'>You&nbsp;&nbsp;</span>" + textArea.value + "</div>";
      textArea.value = "";
      textFrom.scrollTop = textFrom.scrollHeight - textFrom.clientHeight;
    }
  });
  document.addEventListener("keydown", event => {
    if (event.keyCode === 13) {
      event.preventDefault();
      if (textArea.value) {
        submitButton.click();
      }
    }
  });
  socket = io.connect(socketUrl);
  socket.emit("lookForSocket");
  setupSocket();
  textFrom.innerHTML = "<div class='text-line'><em>Looking for a user...</em></div>";
  gotStream(localStream);
}

function setupTracker() {
  tracker = null;
  tracker = new tracking.ObjectTracker("face");
  tracker.setInitialScale(4);
  tracker.setStepSize(2);
  tracker.setEdgesDensity(0.1);

  tracking.track("#trackingVideo", tracker, { camera: true });

  tracker.on("track", event => {
    if (event.data.length > 0) {
      if (!faceDetected) {
        startSession();
      }
      faceDetected = true;
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
        clearInterval(interval);
        stopCounterInterval();
      }
    } else {
      if (faceDetected) {
        if (!timeout) {
          timeout = setTimeout(() => { location = "https://google.com" }, 11000);
          interval = setInterval(startCounterInterval, 1000);
        }
      }
    }
  });
}

function startCounterInterval() {
  if (counter <= 5) {
    warning.style.display = "flex";
    counterElement.innerHTML = counter;
  }
  counter--;
}

function stopCounterInterval() {
  warning.style.display = "none";
  counter = 10;
}

function sendMessage(message) {
  socket.emit("message", message);
}

function handleDataMessage(message) {
  textFrom.innerHTML += "<div class='text-line'><span class='them-text'>Them&nbsp;&nbsp;</span>" + message + "</div>";
  textFrom.scrollTop = textFrom.scrollHeight - textFrom.clientHeight;
}

function reroll() {
  remoteVideo.src = "./loadingscreen.mp4";
  textFrom.innerHTML = "<div class='text-line'><em>Looking for a user...</em></div>";
  isStarted = false;
  pc.close();
  pc = null;
  isInitiator = false;
  isChannelReady = false;
  socket.emit("lookForSocket");
  socket.emit("handleNew");
  gotStream(localStream);
}

function gotStream(stream) {
  sendMessage("got user media");
  if (isInitiator) {
    maybeStart();
  }
}

function maybeStart() {
  if (!isStarted && typeof localStream !== "undefined" && isChannelReady) {
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    if (isInitiator) {
      doCall();
    }
  }
}

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(configuration);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = event => { remoteVideo.srcObject = event.stream };
    pc.onremovestream = event => { console.log("Remote stream removed. Event: ", event) };
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
    alert("Cannot create RTCPeerConnection object.");
    return;
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: "candidate",
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  }
}

function doCall() {
  dataChannel = pc.createDataChannel("chat", {
    reliable: true
  });
  dataChannel.onmessage = event => {
    handleDataMessage(event.data);
  }
  pc.createOffer(setLocalAndSendMessage, event => { console.log("createOffer() error: ", event) });
}

function doAnswer() {
  pc.ondatachannel = event => {
    dataChannel = event.channel;
    dataChannel.onmessage = event => {
      handleDataMessage(event.data);
    }
  };
  pc.createAnswer().then(
    setLocalAndSendMessage,
    error => { trace("Failed to create session description: " + error.toString()) }
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function setupSocket() {
  socket.on("clientCount", data => onlineUsers.innerHTML = data + " Online Users");

  socket.on("created", () => isInitiator = true);

  socket.on("joined", () => {
    isChannelReady = true;
    textFrom.innerHTML += "<div class='text-line'><em>Connected!</em></div>";
  });

  socket.on("setup", () => maybeStart());

  socket.on("message", message => {
    if (message === "got user media") {
      maybeStart();
    } else if (message.type === "offer") {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === "answer" && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === "candidate" && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      pc.addIceCandidate(candidate);
    } else if (message === "bye" && isStarted) {
      reroll();
    }
  });
}
