var startButton = document.getElementById("start-button");
var landing = document.getElementById("landing");
var main = document.getElementById("main");
var body = document.querySelector("body");
var landingTracker;
var trackerTask;

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
.then(setupLandingTracker)
.catch(function(e) {
  alert("There was an error getting the stream.");
});

function setupLandingTracker() {
  landingTracker = new tracking.ObjectTracker('face');
  landingTracker.setInitialScale(4);
  landingTracker.setStepSize(2);
  landingTracker.setEdgesDensity(0.1);

  trackerTask = tracking.track('#landingVideo', landingTracker, { camera: true });

  landingTracker.on('track', event => {
    if (event.data.length > 0) {
      startButton.style.display = "flex";
    } else {
      startButton.style.display = "none";
    }
  });
}

startButton.addEventListener("click", function() {
  trackerTask.stop();
  trackerTask = null;
  landingTracker = null;
  body.removeChild(landing);
  main.style.display = "flex";
  var newScript = document.createElement("script");
  newScript.setAttribute("src","./scripts/main.js");
  body.appendChild(newScript);
});
