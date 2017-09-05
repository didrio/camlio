'use strict';

var socketUrl = "https://caml.io";
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var faceDetected = false;
var localStream;
var pc;
var remoteStream;
var dataChannel;
var submitButton = document.getElementById("submit");
var rerollButton = document.getElementById("reroll");
var textArea = document.getElementById("text-area");
var textFrom = document.getElementById("text-from");
var counterElement = document.getElementById("counter");
var onlineUsers = document.getElementById("online-users");
var firstWarning = document.getElementById("first-warning");
var warning = document.getElementById("warning");
var remoteVideo = document.querySelector('#remoteVideo');
var counter = 10;
var timeout;
var interval;
var tracker;
var socket;

var pcConfig = {
  'iceServers': [
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'turn:turn.anyfirewall.com:443?transport=tcp[webrtc:webrtc]'}
  ]
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
.catch(function(e) {
  alert("There was an error getting the stream.");
});

function startSession() {
  firstWarning.style.display = "none";
  window.onbeforeunload = function() {
    sendMessage('bye');
  };
  rerollButton.addEventListener("click", event => {
    sendMessage('bye');
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
  console.log("ayye");
}

function setupTracker() {
  tracker = null;
  tracker = new tracking.ObjectTracker('face');
  tracker.setInitialScale(4);
  tracker.setStepSize(2);
  tracker.setEdgesDensity(0.1);

  tracking.track("#trackingVideo", tracker, { camera: true });

  tracker.on('track', event => {
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
          timeout = setTimeout(noFace, 11000);
          interval = setInterval(startCounterInterval, 1000);
        }
      }
    }
  });
}

function noFace() {
  location = "https://google.com";
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
  socket.emit('message', message);
}

function handleDataMessage(message) {
  textFrom.innerHTML += "<div class='text-line'><span class='them-text'>Them&nbsp;&nbsp;</span>" + message + "</div>";
  textFrom.scrollTop = textFrom.scrollHeight - textFrom.clientHeight;
}

function reroll() {
  remoteVideo.src = "./loadingscreen.mp4";
  textFrom.innerHTML = "<div class='text-line'><em>Looking for a user...</em></div>";
  handleRemoteHangup();
  isChannelReady = false;
  remoteStream = undefined;
  socket.emit("lookForSocket");
  socket.emit("handleNew");
  gotStream(localStream);
}

function gotStream(stream) {
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

function maybeStart() {
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
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
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  dataChannel = pc.createDataChannel("chat", {
    reliable: true
  });
  dataChannel.onmessage = function(event) {
    handleDataMessage(event.data);
  }
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  pc.ondatachannel = function(event) {
    dataChannel = event.channel;
    dataChannel.onmessage = function(event) {
      handleDataMessage(event.data);
    }
  };
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function handleRemoteStreamAdded(event) {
  remoteVideo.src = "";
  remoteVideo.srcObject = event.stream;
  remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function handleRemoteHangup() {
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

function setupSocket() {
  socket.on("clientCount", data => {
    onlineUsers.innerHTML = data + " Online Users";
  });

  socket.on('created', function() {
    isInitiator = true;
  });

  socket.on('joined', function() {
    isChannelReady = true;
    textFrom.innerHTML += "<div class='text-line'><em>Connected!</em></div>";
  });

  socket.on("setup", () => {
    maybeStart();
  });

  socket.on('message', function(message) {
    if (message === 'got user media') {
      maybeStart();
    } else if (message.type === 'offer') {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === 'answer' && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
      reroll();
    }
  });
}
