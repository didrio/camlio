var startButton = document.getElementById("start-button");
var landing = document.getElementById("landing");
var main = document.getElementById("main");
var body = document.querySelector("body");

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(setupTracker)
.catch(function(e) {
  alert("There was an error getting the stream.");
});

function setupTracker(stream) {
  var tracker = new tracking.ObjectTracker('face');
  tracker.setInitialScale(4);
  tracker.setStepSize(2);
  tracker.setEdgesDensity(0.1);

  tracking.track('#landingVideo', tracker, { camera: true });

  tracker.on('track', event => {
    if (event.data.length === 1) {
      startButton.style.display = "flex";
    } else {
      startButton.style.display = "none";
    }
  });
}

startButton.addEventListener("click", function() {
  body.removeChild(landing);
  main.style.display = "flex";
  tracker = undefined;
  var newScript = document.createElement("script");
  newScript.setAttribute("src","./scripts/main.js");
  body.appendChild(newScript);
});
