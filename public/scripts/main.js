'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var dataChannel;
var submitButton = document.getElementById("submit");
var rerollButton = document.getElementById("reroll");
var textArea = document.getElementById("text-area");
var textFrom = document.getElementById("text-from");
var counterElement = document.getElementById("counter");
var onlineUsers = document.getElementById("online-users");
var warning = document.getElementById("warning");
var remoteVideo = document.querySelector('#remoteVideo');
var counter = 10;
var timeout;
var interval;
var tracker;

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

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(stream => {
  localStream = stream;
  gotStream(localStream);
  document.querySelector("#trackingVideo").srcObject = stream;
})
.catch(function(e) {
  alert("There was an error getting the stream.");
});

function handleDataMessage(message) {
  if (message === "//face--face//") {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
      clearInterval(interval);
      stopCounterInterval();
    }
  } else if (message === "//noface--noface//") {
    if (!timeout) {
      timeout = setTimeout(noFace, 11000);
      interval = setInterval(startCounterInterval, 1000);
    }
  } else {
    textFrom.innerHTML += "<div class='text-line'><span class='them-text'>Them&nbsp;&nbsp;</span>" + message + "</div>";
    textFrom.scrollTop = textFrom.scrollHeight - textFrom.clientHeight;
  }
}

function setupTracker() {
  tracker = null;
  tracker = new tracking.ObjectTracker('face');
  tracker.setInitialScale(4);
  tracker.setStepSize(2);
  tracker.setEdgesDensity(0.1);

  tracking.track("#remoteVideo", tracker, { camera: true });

  tracker.on('track', event => {
    if (dataChannel) {
      if (event.data.length > 0) {
        dataChannel.send("//face--face//");
      } else {
        dataChannel.send("//noface--noface//");
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

var pcConfig = {
  'iceServers': [
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'turn:turn.anyfirewall.com:443?transport=tcp[webrtc:webrtc]'}
  ]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

/////////////////////////////////////////////

var socket = io.connect();

// gotStream(localStream);

socket.emit("lookForSocket");

textFrom.innerHTML = "<div class='text-line'><em>Looking for a user...</em></div>";

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

////////////////////////////////////////////////

function sendMessage(message) {
  socket.emit('message', message);
}

// This client receives a message
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

function reroll() {
  remoteVideo.src = "./loadingscreen.mp4";
  textFrom.innerHTML = "<div class='text-line'><em>Looking for a user...</em></div>";
  handleRemoteHangup();
  isChannelReady = false;
  remoteStream = undefined;
  turnReady = undefined;
  socket.emit("lookForSocket");
  socket.emit("handleNew");
  gotStream(localStream);
}

socket.on("setup", () => {
  maybeStart();
});

////////////////////////////////////////////////////

function gotStream(stream) {
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
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

window.onbeforeunload = function() {
  sendMessage('bye');
  dataChannel.send("//face--face//");
};

/////////////////////////////////////////////////////////

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
  setupTracker();
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  pc.ondatachannel = function(event) {
    dataChannel = event.channel;
    dataChannel.onmessage = function(event) {
      handleDataMessage(event.data);
    }
  };
  setupTracker();
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        pcConfig.iceServers.push({
          'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
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

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
          opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length - 1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}
