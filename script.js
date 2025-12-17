/* =========================
   CSUN Location Quiz (Maps)
   ========================= */

/* Google Maps instance */
let map;

/* Visual feedback shown after each guess */
let currentRect = null;   // colored rectangle for correct area
let clickMarker = null;   // marker where the user clicked

/* Game constants */
const TOTAL_QUESTIONS = 5;
const BEST_KEY = "csun_map_quiz_best_seconds";

/* Fixed camera view for the entire game */
const FIXED_VIEW = {
  center: { lat: 34.24105, lng: -118.52800 },
  zoom: 18
};

/*
  Location data.
  Each object represents one building and the rectangular bounds
  that define a correct answer.
*/
const LOCATIONS = [
  {
    name: "Black House",
    bounds: {
      north: 34.244278,
      south: 34.244069,
      east: -118.533368,
      west: -118.533626
    }
  },
  {
    name: "Chaparral Hall",
    bounds: {
      north: 34.238634,
      south: 34.237832,
      east: -118.526679,
      west: -118.527306
    }
  },
  {
    name: "Matador Track Stadium",
    bounds: {
      north: 34.247868,
      south: 34.246043,
      east: -118.525570,
      west: -118.52730
    }
  },
  {
    name: "Sierra Hall",
    bounds: {
      north: 34.238561,
      south: 34.238056,
      east: -118.529978,
      west: -118.531517
    }
  },
  {
    name: "Bookstein Hall",
    bounds: {
      north: 34.242471,
      south: 34.241471,
      east: -118.529919,
      west: -118.531159
    }
  }
];

/* Tracks the current game state */
const state = {
  index: 0,        // current question index
  correct: 0,      // number of correct answers
  startedAtMs: null,
  timerId: null
};

/*
  Called automatically by Google Maps once the API loads.
  This sets up the map and starts the game.
*/
window.initMap = function initMap() {
  renderBest(); // load best score from localStorage

  const mapEl = document.getElementById("map");
  if (!mapEl) {
    console.error("Map container #map not found");
    return;
  }

  /* Create the map with all interaction disabled */
  map = new google.maps.Map(mapEl, {
    center: FIXED_VIEW.center,
    zoom: 16,
    mapTypeId: "satellite",

    // Remove all built-in UI controls
    disableDefaultUI: true,

    // Disable all user movement and zooming
    gestureHandling: "none",
    draggable: false,
    scrollwheel: false,
    disableDoubleClickZoom: true,
    keyboardShortcuts: false,

    clickableIcons: false,
    styles: [{ elementType: "labels", stylers: [{ visibility: "off" }] }]
  });

  resetGame();

  /* Handle user guesses via double click */
  map.addListener("dblclick", (e) => {
    handleAnswer(e.latLng);
  });

  /* Reset button handler */
  $("#resetBtn").on("click", resetGame);
};

/*
  Resets all game state and starts a new round
*/
function resetGame() {
  clearFeedback();
  state.index = 0;
  state.correct = 0;
  startTimer();

  updateHeader();
  setPrompt();
  showToast("Game started. Double-click the correct building.");
}

/*
  Handles a user guess and determines correctness
*/
function handleAnswer(latLng) {
  const loc = LOCATIONS[state.index];
  if (!loc) return;

  const isCorrect = pointInBounds(latLng, loc.bounds);
  if (isCorrect) state.correct += 1;

  // Show correct area in green or red
  drawFeedback(latLng, loc.bounds, isCorrect);

  showToast(isCorrect ? "Correct!" : "Wrong!");

  state.index += 1;

  if (state.index >= TOTAL_QUESTIONS) {
    finishGame();
    return;
  }

  updateHeader();
  setPrompt();
}

/*
  Ends the game, checks high score, and displays final results
*/
function finishGame() {
  stopTimer();

  const seconds = elapsedSeconds();
  const best = getBestSeconds();

  if (best == null || seconds < best) {
    setBestSeconds(seconds);
    renderBest();
    showToast(`Finished: ${state.correct}/5 in ${formatTime(seconds)} (NEW BEST)`);
  } else {
    showToast(`Finished: ${state.correct}/5 in ${formatTime(seconds)}`);
  }

  $("#promptText").text(`Done. You got ${state.correct} out of 5 correct.`);
  $("#qCount").text(`5 / 5`);
}

/*
  Updates the location name shown to the user
*/
function setPrompt() {
  const el = document.getElementById("promptText");
  if (!el) return;

  const q = LOCATIONS[state.index];
  el.textContent = q ? q.name : "Done";
}

/*
  Updates question count and score display
*/
function updateHeader() {
  $("#qCount").text(`${state.index + 1} / 5`);
  $("#score").text(state.correct);
}

/* ---------- Visual feedback ---------- */

/*
  Removes any previous markers or rectangles
*/
function clearFeedback() {
  if (currentRect) currentRect.setMap(null);
  if (clickMarker) clickMarker.setMap(null);
  currentRect = null;
  clickMarker = null;
}

/*
  Draws the colored rectangle and click marker
*/
function drawFeedback(clickedLatLng, bounds, isCorrect) {
  clearFeedback();

  const bb = normalizeBounds(bounds);

  currentRect = new google.maps.Rectangle({
    bounds: bb,
    map,
    clickable: false,
    strokeOpacity: 1,
    strokeWeight: 3,
    fillOpacity: 0.18,
    strokeColor: isCorrect ? "#1f7a1f" : "#b00020",
    fillColor: isCorrect ? "#1f7a1f" : "#b00020"
  });

  clickMarker = new google.maps.Marker({
    position: clickedLatLng,
    map,
    clickable: false
  });

  flashRect(currentRect);
}

/*
  Brief animation effect for rectangle feedback
*/
function flashRect(rect) {
  const original = rect.get("fillOpacity");
  rect.setOptions({ fillOpacity: 0.35 });
  setTimeout(() => rect.setOptions({ fillOpacity: original }), 180);
}

/* ---------- Bounds logic ---------- */

/*
  Ensures bounds are correctly ordered
  (important for negative longitude values)
*/
function normalizeBounds(b) {
  return {
    north: Math.max(b.north, b.south),
    south: Math.min(b.north, b.south),
    east: Math.max(b.east, b.west),
    west: Math.min(b.east, b.west)
  };
}

/*
  Checks if a clicked point is inside a location rectangle
*/
function pointInBounds(latLng, b) {
  const bb = normalizeBounds(b);
  const lat = latLng.lat();
  const lng = latLng.lng();

  return (
    lat <= bb.north &&
    lat >= bb.south &&
    lng <= bb.east &&
    lng >= bb.west
  );
}

/* ---------- Timer and high score ---------- */

function startTimer() {
  stopTimer();
  state.startedAtMs = Date.now();
  $("#timer").text("00:00");

  state.timerId = setInterval(() => {
    $("#timer").text(formatTime(elapsedSeconds()));
  }, 250);
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function elapsedSeconds() {
  if (!state.startedAtMs) return 0;
  return Math.floor((Date.now() - state.startedAtMs) / 1000);
}

function formatTime(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function getBestSeconds() {
  const raw = localStorage.getItem(BEST_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function setBestSeconds(seconds) {
  localStorage.setItem(BEST_KEY, String(seconds));
}

function renderBest() {
  const best = getBestSeconds();
  $("#best").text(best == null ? "—" : formatTime(best));
}

/* ---------- Toast messages ---------- */

let toastTimer = null;
function showToast(msg) {
  const $t = $("#toast");
  $t.text(msg).addClass("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $t.removeClass("show"), 1400);
}
