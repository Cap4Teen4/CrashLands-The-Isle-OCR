// ═══════════════════════════════════════════════════════════════════
//  The Isle - Multiplayer Position Tracker (app.js)
//  Room management, WebSocket sync, multi-player map rendering
// ═══════════════════════════════════════════════════════════════════

// ── Server Config ──
// For local dev: 'ws://localhost:3000'
// For production: 'wss://your-app.fly.dev'
const WS_URL = 'wss://live-isle-tracker.fly.dev';

// ── Constants ──
const MAX_PLAYERS = 8;
const MAX_TRAIL = 25;
const TRAIL_EXPIRE_MS = 20 * 60 * 1000; // 20 minutes
const WRITE_THROTTLE_MS = 500;

// ── State ──
let ws = null;
let roomCode = null;
let playerId = null;
let playerName = '';
let playerColor = '#c60feb';
let players = new Map(); // id → {name, color, lat, long, lastUpdate, trail:[]}

// Map image — bounds in game coordinates (official map grid coords × 1000)
// X = horizontal = Long, Y = vertical = Lat
// Image corners: top-left (Lat=-615, Long=-560), bottom-right (Lat=615, Long=675)     Old{ minX: -530000, maxX: 622000, minY: -588000, maxY: 485000 };   Possible New{ minX: -525000, maxX: 622000, minY: -590000, maxY: 485000 };
const MAP_BOUNDS = {
  minX: -530,
  maxX: 622,
  minY: -588,
  maxY: 485
};

const mapImg = new Image();
mapImg.src = 'assets/img/map-light.png';
let mapLoaded = false;
mapImg.onload = () => {
  mapLoaded = true;

  resize();           // make sure canvas has size
  fitMapToScreen();   // 🔥 apply correct zoom
};

const waterImg = new Image();
waterImg.src = 'assets/img/water.png';
let waterLoaded = false;
waterImg.onload = () => { waterLoaded = true; };

const mudImg = new Image();
mudImg.src = 'assets/img/mudOverlay.png';
let mudLoaded = false;
mudImg.onload = () => { mudLoaded = true; };

const structImg = new Image();
structImg.src = 'assets/img/structures.png';
let structLoaded = false;
structImg.onload = () => { structLoaded = true; };

const migrationImg = new Image();
migrationImg.src = 'assets/img/migration.png';
let migrationLoaded = false;
migrationImg.onload = () => { migrationLoaded = true; };

const sanctImg = new Image();
sanctImg.src = 'assets/img/sanctuaries.png';
let sanctLoaded = false;
sanctImg.onload = () => { sanctLoaded = true; };

const patrolImg = new Image();
patrolImg.src = 'assets/img/PatrolZones.png';
let patrolLoaded = false;
patrolImg.onload = () => { patrolLoaded = true; };

// Toggle state for optional overlays
let showMigration = false;
let showSanctuaries = false;
let showStructures = false;
let showMud = false;
let showPatrolZones = false;

let showLakeLabels = true;
let showSectorLabels = true;
let showBuildingLabels = true;
let showWaterLabels = true;
let showExtraLabels = true;

let showBoar = false;
let showBunny = false;
let showChicken = false;
let showDeer = false;
let showGoat = false;

let showFish = false;
let showFrog = false;
let showCrab = false;
let showTurtle = false;

let showSalt = false;
let showGastro = false;

// Boar sighting locations (long, lat) — extracted from Gateway Isle Map
const BOAR_LOCATIONS = [
  //SOUTH PLAINS
  [-276, 238],[-265, 250],[-334, 284],[-226, 335],[-266, 298],
  [-69, 250],[58, 269],[149, 324],[147, 212],[65, 307],
  //DELTA
  [191, 81],[116, -19],[149, -40],[262, 61],[119, -61],[79, -65],
  [32, -31],[160, -102],[154, -157],[256, -127],[199, -187],[118, 58],
  //HIGHLANDS
  [-154, -23],[-256, -115],
  //EASTSIDE
  [296, -9],[246, -60],[297, -87],[338, -77],[348, -37],[372, -113],
  [489, -162],[454, -181],[442, -95],[444, -64],[428, -4],[400, -283],[416, -338],
];
// Bunny sighting locations (long, lat) — extracted from Gateway Isle Map
const BUNNY_LOCATIONS = [
  [-332, 271], [-383, 185], [-321, 61], [-214, 49], [-296, -15],
  [-161, -22], [-175, -120], [24, 81], [89, -9], [30, -104],
  [141, -1], [0, -161], [201, -144], [292, -163], [153, -262],
];
// Chicken sighting locations (long, lat) — extracted from Gateway Isle Map
const CHICKEN_LOCATIONS = [
  [-302, 285], [-240, 257], [-232, 342], [-198, 253], [-54, 306], [70, 307],
  [117, 221], [162, 255], [165, 291], [132, 347], [36, 120], [31, 94], [-200, 76],
  [121, -25], [231, 43], [256, 60], [272, 18], [150, -71], [223, -76], [225, -63],
  [225, -63], [342, -34], [-235, 61], [-320, -22], [-55, -137], [51, -108], [-2, -213],
  [13, -203], [130, -158], [235, -385], [399, -150], [523, -274],
];
// Goat sighting locations (long, lat) — extracted from Gateway Isle Map
const GOAT_LOCATIONS = [
  [-80, -125], [-51, -149], [-42, -140],[-13, -137],[23, -185],[46, -172],[40, -128],
  [-270, -98],[-104, 17],
];

// Deer sighting locations (long, lat) — extracted from Gateway Isle Map
const DEER_LOCATIONS = [
[-371, 203],[-335, 229],[-278, 237],[-322, 317],[-322, 317],[-216, 336],[-220, 303],[-217, 285],
[-51, 311],[-167, 273],[-160, 305],[68, 362],[76, 303],[31, 204],[155, 274],[161, 312],[168, 346],
[252, 107],[178, 47],[140, 20],[115, 26],[256, 26],[243, 3],[319, 51],[260, -13],[336, 13],
[-263, 83],[-222, 63],[-265, 20],[-205, 21],[-340, 61],[-360, 54],[-295, -63],[-280, -90],
[116, -23],[65, -102],[153, -87],[177, -136],[202, -129],[188, -109],[199, -83],[244, -116],
[201, -56],[243, -71],[301, -82],[411, -33],[369, -114],[424, -93],[431, -107],[454, -66],
[470, -137],[482, -161],[518, -174],[455, -188],[404, -315],[413, -339],[335, -348],
[295, -398],[249, -373],[225, -387],[202, -338],
];




// Crab sighting locations (long, lat) — extracted from Gateway Isle Map
const FISH_LOCATIONS = [
  [135, 22],[146, 44],[149, 56],[200, 67],[215, 65],[227, 144],[187, 150],[192, 165],[182, 189],[160, 194],[129, 198],
  [187, -68],[-75, -97],[259, -95],[182, -62],[166, -30],[164, -21],[170, -13],[210, -149],[306, -105],[325, -117],[372, -183],
  [330, -384],[345, -355],[321, -350],[356, -346],[388, -303],[485, -171],[479, -149],[464, -166],[458, -145],[466, -120],[473, -103],
  [453, -119],[334, 37],[97, 183],[89, 188],[98, 199],[106, 219],[95, 226],[85, 228],[70, 227],[82, 210],[76, 196],[122, 255],
  [131, 273],[146, 301],[60, 271],[63, 256],[62, 290],[22, 265],[-30, 277],[-65, 287],[-42, 229],[67, 346],
  [-207, 207],[-212, 154],[-218, 145],[-169, 67],[-296, 7],[52, -249],[59, -240],[70, -273],[92, -252],[77, -254],[196, -65],
];
// Turtle sighting locations (long, lat) — extracted from Gateway Isle Map
const TURTLE_LOCATIONS = [
[557, -150],[537, -128],[527, -106],[523, -88],[523, -67],[450, -34],[451, -17],[435, 5],[412, 1],[350, -22],[345, 59],[178, 275],[209, 327],
[175, 358],[117, 361],[65, 376],[55, 381],[45, 390],[-6, 411],[-38, 396],[-63, 348],[-89, 343],[-177, 325],[-196, 339],[-269, 377],[-291, 348],[-349, 350],[-383, 339],
[-317, 355],[-361, 302],[-382, 267],[-429, 269],[-418, 239],[-407, 149],[-383, 135],[-370, 131],[-347, 114],[-323, 109],[-353, 101],[-319, 88],[-337, 86],[-356, 74],
[-348, 58],[-281, 207],[-295, 195],[-294, 177],[-306, 161],[-313, 145],[-338, 139],[-366, 40],[-391, 24],[-384, 1],[-371, -29],
];
// Frog sighting locations (long, lat) — extracted from Gateway Isle Map
const FROG_LOCATIONS = [
  [98, -259],[96, -236],[67, -228],[51, -98],[349, -159],[166, -25],[167, -18],[206, 114],[-210, 229],[-208, 203],
];
// Crab sighting locations (long, lat) — extracted from Gateway Isle Map
const CRAB_LOCATIONS = [
  [243, 43],[247, 126],[311, 88],[346, 54],[349, 46],[351, 35],[355, 20],[358, 7],[352, -11],[350, -26],[369, -35],[228, 171],[197, 211],
  [185, 222],[256, 233],[164, 189],[182, 290],[191, 342],[123, 238],[110, 242],[100, 240],[98, 252],[43, 256],[-67, 286],
  [-80, 347],[-85, 356],[-26, 400],[78, 379],[126, 363],[-161, 285],[-152, 289],[-142, 321],[-184, 334],[-199, 348],[-287, 345],
  [-344, 351],[-461, 267],[-424, 272],[-426, 258],[-397, 270],[-345, 135],[-379, 128],[-354, 69],[-309, 80],[-369, 38],[-295, 6],[202, -108],[210, -118],
  [543, -138],[536, -118],[527, -103],[522, -91],[522, -76],[522, -57],[370, -274],
];



// Salt deposit locations (long × 1000, lat × 1000)
const SALT_LOCATIONS = [
  [120, 170], [51, 68], [9, 274], [-170, 238], [-302, 117], [-319, -29], [-103, 34], [26, 386],
  [282, 54], [158, -57], [325, -142], [156, -175], [48, -227], [-166, -110], [468, -53], [555, -246],
  [373, -261], [240, -313], [231, -319], [229, -423], [469, -435], [392, 132], 
];
const GASTRO_LOCATIONS = [
  //Highlands
  [-182, -66],[-171, -53],[-109, -58],[-103, -59],[-274, -105],[-244, -105],[-200, -126],[-181, -139],[-58, -163],[-46, -154],[-54, -120],[-42, -147],
  [-34, -111],[-21, -76],[-4, -70],[-10, -93],[-2, -123],[-14, -146],[-9, -156],[-8, -162],[-12, -176],[-12, -197],[-19, -204],[-21, -220],[9, -225],
  //Delta
  [211, -96], [219, -98], [222, -64], [209, -62], [196, -61], [151, -16], [145, -27], [182, 8], [210, -80],[206, -75],
  [195, -10], [208, 7], [132, 35], [143, 50], [154, 66], [180, 75], [220, 93], [252, 94],[55, -280],[193, -71],
  [233, 65], [222, 62], [48, 187], [-142, 186], [214, 6],[108, -76],[192, -168],[176, -166],[109, -238],[80, -282],
  //NorthPlains
  [503, -275],[483, -294],[487, -286],[500, -281],[320, -230],[311, -220],[295, -246],[299, -285],[316, -307],[195, -375],[424, -430],
  [299, -324],[271, -322],[383, -316],[375, -333],[355, -343],[353, -352],[333, -374],[323, -380],[231, -361],[321, -412],[439, -418],[472, -433],
  [284, -154],[287, -152],[265, -147],[261, -168],[269, -201],[213, -242],[224, -222],[210, -259],[194, -269],[191, -273],[185, -273],[187, -289],
  [229, -296],
  //East-Swamp
  [226, -49],[216, -33],[228, -29],[234, -24],[263, -55],[273, -73],[252, -92],[273, -103],[315, -101],[321, -122],[345, 43],[350, -1],
  [425, 2],[443, -53],[463, -50],[449, -64],[443, -71],[516, -75],[522, -106],[476, -147],[535, -145],[544, -152],[521, -196],
  [460, -190],[436, -169],[544, -204],[507, -232],
  //Swamp
  [51, 205], [63, 204],[54, 224],[101, 267],[113, 286],[72, 274], [35, 286], [22, 274], [65, 352], [83, 374], [109, 354], [24, 357], 
  [169, 326], [175, 329], [165, 333], [171, 339], [81, 175], [125, 174], [129, 188], [166, 165], [-38, 312], [-75, 260], [-91, 320], [-103, 311],
  [-64, 369],
  //south Plains
  [-184, 217], [-197, 238],[-201, 250],[-189, 259],[-150, 292],[-158, 319],[-190, 333],[-235, 365],[-268, 377], [-268, 377], [-390, 333], [-341, 162],
  [-421, 278], [-418, 242], [-418, 228], [-418, 209], [-415, 172], [-414, 165], [-408, 154], [-307, 210], [-275, 201], [-198, 181], [-216, 167], [-340, 145],
  [-286, 6], [-303, 5], [279, 9],
];

// Map state
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let viewX = 0, viewY = 0, zoom = 0.0008;
let dragging = false, dragStartX = 0, dragStartY = 0, dragViewX = 0, dragViewY = 0;
let autoCenter = true;
let lastWrite = 0;
let mouseWorldX = 0, mouseWorldY = 0;
let mouseOnCanvas = false;
// Waypoints: playerId → {lat, long} or null
let waypoints = new Map();

// Subtle click sound for waypoint placement
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playWaypointSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.1);
}

// ── WebSocket ──

function connectWebSocket() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      document.getElementById('connection-status').textContent = '';
      resolve();
    };

    ws.onerror = () => {
      reject(new Error('Could not connect to server'));
    };

    ws.onclose = () => {
      document.getElementById('connection-status').textContent = '(Disconnected)';
      ws = null;
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      handleServerMessage(msg);
    };
  });
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'created':
      roomCode = msg.room;
      playerId = msg.playerId;
      playerColor = msg.color;
      players.set(playerId, { name: playerName, color: msg.color, lat: null, long: null, lastUpdate: Date.now(), trail: [] });
      enterTracker();
      break;

    case 'joined':
      playerId = msg.playerId;
      playerColor = msg.color;
      // Load existing players
      for (const p of msg.players) {
        players.set(p.id, { ...p, trail: [] });
      }
      enterTracker();
      break;

    case 'error':
      showLobbyError(msg.message);
      break;

    case 'room_expired':
      alert(msg.message);
      leaveRoom();
      break;

    case 'player_joined':
      players.set(msg.playerId, { name: msg.name, color: msg.color, lat: null, long: null, lastUpdate: Date.now(), trail: [] });
      renderSidebar();
      break;

    case 'update': {
      const p = players.get(msg.playerId);
      if (p) {
        if (msg.lat != null && msg.long != null) {
          const last = p.trail[p.trail.length - 1];
          if (!last || last[0] !== msg.lat || last[1] !== msg.long) {
            p.trail.push([msg.lat, msg.long, Date.now()]);
            if (p.trail.length > MAX_TRAIL) p.trail = p.trail.slice(-MAX_TRAIL);
          }
        }
        p.lat = msg.lat;
        p.long = msg.long;
        p.alt = msg.alt;
        p.lastUpdate = msg.lastUpdate;
      }
      renderSidebar();
      break;
    }

    case 'player_left':
      players.delete(msg.playerId);
      waypoints.delete(msg.playerId);
      renderSidebar();
      break;

    case 'waypoint':
      if (msg.lat != null && msg.long != null) {
        waypoints.set(msg.playerId, { lat: msg.lat, long: msg.long });
        playWaypointSound();
      } else {
        waypoints.delete(msg.playerId);
      }
      break;
  }
}

function wsSend(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Lobby ──

function showJoinInput() {
  const section = document.getElementById('join-section');
  section.style.display = section.style.display === 'none' ? 'block' : 'none';
  if (section.style.display === 'block') {
    document.getElementById('room-code-input').focus();
  }
}

function showLobbyError(msg) {
  document.getElementById('lobby-error').textContent = msg;
}

async function createRoom() {
  playerName = document.getElementById('player-name').value.trim();
  if (!playerName) { showLobbyError('Enter your name'); return; }

  try {
    await connectWebSocket();
    wsSend({ type: 'create', name: playerName });
  } catch (e) {
    showLobbyError('Failed to connect: ' + e.message);
  }
}

async function joinRoom() {
  playerName = document.getElementById('player-name').value.trim();
  if (!playerName) { showLobbyError('Enter your name'); return; }

  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (code.length !== 6) { showLobbyError('Room code must be 6 characters'); return; }

  roomCode = code;

  try {
    await connectWebSocket();
    wsSend({ type: 'join', room: code, name: playerName });
  } catch (e) {
    showLobbyError('Failed to connect: ' + e.message);
  }
}

function enterTracker() {
  document.getElementById('lobby').classList.add('hidden');
  document.getElementById('tracker').classList.add('active');
  document.getElementById('room-code-display').textContent = roomCode;

  resize();
  fitMapToScreen(); // ✅ THIS IS THE FIX
  draw();
}
function resize() {
  if (!canvas.parentElement) return;

  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  // calculate FIT ZOOM (this becomes your zoom-out limit)
  const fitX = canvas.width / mapImage.width;
  const fitY = canvas.height / mapImage.height;

  minZoom = Math.min(fitX, fitY);

  // only set zoom on first load OR if user is not manually zoomed in
  if (!zoom || zoom < minZoom) {
    zoom = minZoom;
  }
}
let minZoom = null;



function leaveRoom() {
  if (ws) { ws.close(); ws = null; }
  stopOCR();
  players.clear();
  roomCode = null;
  playerId = null;

  document.getElementById('lobby').classList.remove('hidden');
  document.getElementById('tracker').classList.remove('active');
  document.getElementById('lobby-error').textContent = '';
  document.getElementById('capture-btn').textContent = 'SHARE SCREEN';
  document.getElementById('capture-btn').classList.remove('active-capture');
}

let codeHidden = false;
function toggleCodeVisibility(e) {
  e.stopPropagation();
  codeHidden = !codeHidden;
  const display = document.getElementById('room-code-display');
  const btn = document.getElementById('hide-code-btn');
  if (codeHidden) {
    display.textContent = '******';
    btn.style.color = '#e06c75';
  } else {
    display.textContent = roomCode;
    btn.style.color = '#556';
  }
}

function copyRoomCode() {
  navigator.clipboard.writeText(roomCode).then(() => {
    const badge = document.getElementById('room-badge');
    const hint = badge.querySelector('.copy-hint');
    hint.textContent = 'copied!';
    setTimeout(() => { hint.textContent = 'copy'; }, 1500);
  });
}

// ── Sidebar ──

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatAgo(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 3) return 'now';
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  return Math.floor(min / 60) + 'h ago';
}

// Re-render sidebar every second to keep "ago" times fresh
// Also prune expired trail entries
setInterval(() => {
  if (players.size === 0) return;
  const cutoff = Date.now() - TRAIL_EXPIRE_MS;
  for (const [, p] of players) {
    if (p.trail.length > 1 && p.trail[0][2] < cutoff) {
      const fresh = p.trail.filter(t => t[2] >= cutoff);
      // Always keep the last point (current position)
      p.trail = fresh.length > 0 ? fresh : [p.trail[p.trail.length - 1]];
    }
  }
  renderSidebar();
}, 1000);

function renderSidebar() {
  document.getElementById('player-count').textContent = `${players.size}/${MAX_PLAYERS}`;

  const listEl = document.getElementById('player-list');
  listEl.innerHTML = '';
  for (const [id, p] of players) {
    const isStale = p.lastUpdate && (Date.now() - p.lastUpdate > 5000);
    const div = document.createElement('div');
    div.className = 'player-item' + (isStale ? ' player-stale' : '');
    const ago = p.lastUpdate && p.lat != null ? formatAgo(Date.now() - p.lastUpdate) : '';
    div.innerHTML = `
      <span class="player-dot" style="background:${p.color}"></span>
      <div style="flex:1;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span class="player-name" style="color:${p.color}">${escapeHtml(p.name)}${id === playerId ? ' (you)' : ''}</span>
          <span class="player-coords">${p.lat != null ? p.lat.toFixed(0) + ', ' + p.long.toFixed(0) : '---'}</span>
        </div>
        ${ago ? '<div style="color:#556;font-size:9px;margin-top:1px">updated ' + ago + '</div>' : ''}
      </div>
    `;
    listEl.appendChild(div);
  }

  const local = players.get(playerId);
  if (local) {
    document.getElementById('lat-val').textContent = local.lat != null ? local.lat.toFixed(3) : '---';
    document.getElementById('long-val').textContent = local.long != null ? local.long.toFixed(3) : '---';
  }
}

// ── Position Update (called from ocr.js) ──

function updateMyPosition(lat, long) {
  if (!ws || !playerId) return;

  const now = Date.now();
  if (now - lastWrite < WRITE_THROTTLE_MS) return;
  lastWrite = now;

  // Update local player trail immediately (don't wait for server echo)
  const local = players.get(playerId);
  if (local) {
    const last = local.trail[local.trail.length - 1];
    if (!last || last[0] !== lat || last[1] !== long) {
      local.trail.push([lat, long, Date.now()]);
      if (local.trail.length > MAX_TRAIL) local.trail = local.trail.slice(-MAX_TRAIL);
    }
    local.lat = lat;
    local.long = long;
    local.lastUpdate = now;
  }

  wsSend({ type: 'position', lat, long });
  renderSidebar();
}

function clearMyTrail() {
  const local = players.get(playerId);
  if (local) local.trail = [];
}

function updateOCRStatus(status) {
  const dot = document.getElementById('ocr-dot');
  dot.className = 'ocr-dot ' + status;

  const statusEl = document.getElementById('status');
  if (status === 'active') {
    statusEl.textContent = 'Tracking (OCR active)';
    statusEl.className = '';
  } else if (status === 'stale') {
    statusEl.textContent = 'Tracking (last known position)';
    statusEl.className = '';
  } else {
    statusEl.textContent = 'Waiting for OCR data... Press Tab in-game';
    statusEl.className = 'detecting';
  }
}

// ── Manual Coordinates ──

function applyManualCoords() {
  const input = document.getElementById('manual-coords');
  const raw = input.value.trim();
  if (!raw) return;

  // Split on comma followed by whitespace (value separator)
  // Commas within numbers (thousands separators) are NOT followed by spaces
  const parts = raw.split(/,\s+/);
  if (parts.length < 2) {
    input.style.borderColor = '#e06c75';
    setTimeout(() => input.style.borderColor = '#1a3a4a', 1500);
    return;
  }

  const lat = parseFloat(parts[0].replace(/,/g, ''));
  const long = parseFloat(parts[1].replace(/,/g, ''));

  if (isNaN(lat) || isNaN(long)) {
    input.style.borderColor = '#e06c75';
    setTimeout(() => input.style.borderColor = '#1a3a4a', 1500);
    return;
  }

  // Update OCR lastCoords so jump filter doesn't reject future OCR reads near this position
  lastCoords = { lat, long };

  updateMyPosition(lat, long);
  updateOCRStatus('active');

  input.style.borderColor = '#2a6a3a';
  setTimeout(() => input.style.borderColor = '#1a3a4a', 1500);
}

// ── Canvas / Map ──

function resize() {
  if (!canvas.parentElement) return;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resize);

canvas.addEventListener('mousedown', e => {
  dragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragViewX = viewX;
  dragViewY = viewY;
  autoCenter = false;
});
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();

  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // 🔥 DRAG LOGIC (THIS WAS MISSING)
  if (dragging) {
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;

    viewX = dragViewX + dx;
    viewY = dragViewY + dy;
  }

  // mouse world position
  mouseWorldX = (sx - cx) / zoom - viewX;
  mouseWorldY = (sy - cy) / zoom - viewY;

  mouseOnCanvas = true;
});

canvas.addEventListener('click', e => {
  if (!e.shiftKey) return; // only trigger on SHIFT + click

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

    // 🔥 DRAG LOGIC (THIS WAS MISSING)
  if (dragging) {
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;

    viewX = dragViewX + dx;
    viewY = dragViewY + dy;
  }

  const worldX = (sx - canvas.width / 2) / zoom - viewX;
  const worldY = (sy - canvas.height / 2) / zoom - viewY;

  // ✅ added comma after closing bracket
  const text = `[${worldX.toFixed(0)}, ${worldY.toFixed(0)}],`;

  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied:', text);
  }).catch(err => {
    console.error('Clipboard failed:', err);
  });
});

canvas.addEventListener('mouseup', () => dragging = false);
canvas.addEventListener('mouseleave', () => dragging = false);
canvas.addEventListener('wheel', e => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  const worldX = (sx - cx) / zoom - viewX;
  const worldY = (sy - cy) / zoom - viewY;

  const factor = e.deltaY > 0 ? 0.85 : 1.18;

  zoom *= factor;

  const maxZoom = 10;

  // ✅ LOCK OUTSIDE BOUNDS
  zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

  viewX = -(worldX - (sx - cx) / zoom);
  viewY = -(worldY - (sy - cy) / zoom);
});


canvas.addEventListener('dblclick', () => { autoCenter = true; });
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (!playerId) return;
  const rect = canvas.getBoundingClientRect();
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  const wLong = (sx - cx) / zoom - viewX;
  const wLat = (sy - cy) / zoom - viewY;
  // If already have a waypoint near where we clicked, clear it
  const existing = waypoints.get(playerId);
  if (existing) {
    const [ex, ey] = worldToScreen(existing.long, existing.lat);
    const dist = Math.sqrt((sx - ex) ** 2 + (sy - ey) ** 2);
    if (dist < 30) {
      waypoints.delete(playerId);
      wsSend({ type: 'waypoint', lat: null, long: null });
      return;
    }
  }
  waypoints.set(playerId, { lat: wLat, long: wLong });
  wsSend({ type: 'waypoint', lat: wLat, long: wLong });
});
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  mouseWorldX = (sx - cx) / zoom - viewX;
  mouseWorldY = (sy - cy) / zoom - viewY;
  mouseOnCanvas = true;
});
canvas.addEventListener('mouseleave', () => { mouseOnCanvas = false; });

function worldToScreen(wx, wy) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  return [
    cx + (wx + viewX) * zoom,
    cy + (wy + viewY) * zoom  // Y not flipped — matches game convention (positive = south)
  ];
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function fitMapToScreen() {
  const worldWidth = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const worldHeight = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;

  const zoomX = canvas.width / worldWidth;
  const zoomY = canvas.height / worldHeight;

  zoom = Math.min(zoomX, zoomY);

  minZoom = zoom; // 🔥 LOCK THIS AS THE MINIMUM

  viewX = -(MAP_BOUNDS.minX + MAP_BOUNDS.maxX) / 2;
  viewY = -(MAP_BOUNDS.minY + MAP_BOUNDS.maxY) / 2;
}

function draw() {
  if (!document.getElementById('tracker').classList.contains('active')) {
    requestAnimationFrame(draw);
    return;
  }

  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let anyReady = false;
  for (const [, p] of players) {
    if (p.lat != null) { anyReady = true; break; }
  }

  if (!anyReady && players.size === 0) {
    ctx.fillStyle = '#5ccfe6';
    ctx.font = '16px Fredoka One';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for players...', canvas.width / 2, canvas.height / 2);
    requestAnimationFrame(draw);
    return;
  }

  // Map image
  if (mapLoaded) {
    const [mapSX, mapSY] = worldToScreen(MAP_BOUNDS.minX, MAP_BOUNDS.minY); // top-left (NW corner)
    const [mapEX, mapEY] = worldToScreen(MAP_BOUNDS.maxX, MAP_BOUNDS.maxY); // bottom-right (SE corner)
    const mapW = mapEX - mapSX;
    const mapH = mapEY - mapSY;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(mapImg, mapSX, mapSY, mapW, mapH);
    if (waterLoaded) {
      ctx.drawImage(waterImg, mapSX, mapSY, mapW, mapH);
    }
    if (showMud && mudLoaded) {
      ctx.drawImage(mudImg, mapSX, mapSY, mapW, mapH);
    }
    if (showStructures && structLoaded) {
      ctx.drawImage(structImg, mapSX, mapSY, mapW, mapH);
    }
    if (showMigration && migrationLoaded) {
      ctx.drawImage(migrationImg, mapSX, mapSY, mapW, mapH);
    }
    if (showPatrolZones && patrolLoaded) {
      ctx.drawImage(patrolImg, mapSX, mapSY, mapW, mapH);
    }
    if (showSanctuaries && sanctLoaded) {
      ctx.drawImage(sanctImg, mapSX, mapSY, mapW, mapH);
    }
    if (showBoar) {
      for (const [lng, lat] of BOAR_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 15px Arial';
        ctx.fillText('🐷', sx - 10, sy + 7);
      }
    }
    if (showBunny) {
      for (const [lng, lat] of BUNNY_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 20px Arial';
        ctx.fillText('🐰', sx - 10, sy + 7);
      }
    }
    if (showChicken) {
      for (const [lng, lat] of CHICKEN_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 20px Arial';
        ctx.fillText('🐔', sx - 10, sy + 7);
      }
    }
    if (showGoat) {
      for (const [lng, lat] of GOAT_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);

        ctx.font = 'bold 20px Arial';
        ctx.fillText('🐐', sx - 10, sy + 7);
      }
    }
    if (showDeer) {
      for (const [lng, lat] of DEER_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 20px Arial';
        ctx.fillText('🫎', sx - 10, sy + 7);
      }
    }

    if (showFish) {
      for (const [lng, lat] of FISH_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 20px Arial';
        ctx.fillText('🐠', sx - 10, sy + 7);
      }
    }
    if (showFrog) {
      for (const [lng, lat] of FROG_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 20px Arial';
        ctx.fillText('🐸', sx - 10, sy + 7);
      }
    }
    if (showTurtle) {
      for (const [lng, lat] of TURTLE_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 20px Arial';
        ctx.fillText('🐢', sx - 10, sy + 7);
      }
    }
    if (showCrab) {
      for (const [lng, lat] of CRAB_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 20px Arial';
        ctx.fillText('🦀', sx - 10, sy + 7);
      }
    }


    if (showSalt) {
      for (const [lng, lat] of SALT_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 20px Arial';
        ctx.fillText('🧂', sx - 10, sy + 7);
      }
    }
    if (showGastro) {
      for (const [lng, lat] of GASTRO_LOCATIONS) {
        const [sx, sy] = worldToScreen(lng, lat);
        ctx.font = 'bold 15px Arial';
        ctx.fillText('🪨', sx - 10, sy + 7);
      }
    }

    ctx.globalAlpha = 1.0;
  }

  // Grid
  const startWX = -viewX - canvas.width / 2 / zoom;
  const endWX = -viewX + canvas.width / 2 / zoom;
  const startWY = -viewY - canvas.height / 2 / zoom;
  const endWY = -viewY + canvas.height / 2 / zoom;

  // Major grid — 100k game units = 100 on official map
  const majorGrid = 50;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.lineWidth = 1;
  for (let gx = Math.floor(startWX / majorGrid) * majorGrid; gx < endWX; gx += majorGrid) {
    const [sx] = worldToScreen(gx, 0);
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); ctx.stroke();
  }
  for (let gy = Math.floor(startWY / majorGrid) * majorGrid; gy < endWY; gy += majorGrid) {
    const [, sy] = worldToScreen(0, gy);
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); ctx.stroke();
  }

  // Minor grid — 50k game units = 50 on official map (subdivides major grid)
  const minorGrid = 25;
  ctx.strokeStyle = 'rgba(44, 0, 85, 0.66)';
  for (let gx = Math.floor(startWX / minorGrid) * minorGrid; gx < endWX; gx += minorGrid) {
    if (gx % majorGrid === 0) continue; // skip major lines
    const [sx] = worldToScreen(gx, 0);
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height); ctx.stroke();
  }
  for (let gy = Math.floor(startWY / minorGrid) * minorGrid; gy < endWY; gy += minorGrid) {
    if (gy % majorGrid === 0) continue;
    const [, sy] = worldToScreen(0, gy);
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy); ctx.stroke();
  }

  // Grid labels — major (bold white) and minor (smaller, dimmer)
  // Major labels (every 100)
ctx.font = 'bold 11px Fredoka One';
ctx.textAlign = 'left';

for (let gx = Math.floor(startWX / majorGrid) * majorGrid; gx < endWX; gx += majorGrid) {
  const [sx] = worldToScreen(gx, startWY);

  const label = (gx).toFixed(0); // ✅ FIXED SCALE

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 2;
  ctx.strokeText(label, sx + 2, 14);

  ctx.fillStyle = 'rgba(233, 141, 22, 0.63)';
  ctx.fillText(label, sx + 2, 14);
}

ctx.font = 'bold 11px Fredoka One';
ctx.textAlign = 'left';

for (let gx = Math.floor(startWX / majorGrid) * majorGrid; gx < endWX; gx += majorGrid) {
  const [sx] = worldToScreen(gx, startWY);

  const label = (gx).toFixed(0); // ✅ FIXED SCALE

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 2;
  ctx.strokeText(label, sx + 2, 14);

  ctx.fillStyle = 'rgba(233, 141, 22, 0.63)';
  ctx.fillText(label, sx + 2, 14);
}

ctx.textAlign = 'right';

for (let gy = Math.floor(startWY / majorGrid) * majorGrid; gy < endWY; gy += majorGrid) {
  const [, sy] = worldToScreen(startWX, gy);

  const label = (gy).toFixed(0); // ✅ FIXED SCALE

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 2;
  ctx.strokeText(label, 30, sy - 2);

  ctx.fillStyle = 'rgba(233, 141, 22, 0.63)';
  ctx.fillText(label, 30, sy - 2);
}

ctx.font = '9px Fredoka One';
ctx.textAlign = 'left';

for (let gx = Math.floor(startWX / minorGrid) * minorGrid; gx < endWX; gx += minorGrid) {
  if (gx % majorGrid === 0) continue;

  const [sx] = worldToScreen(gx, startWY);

  const label = (gx).toFixed(0); // ✅ FIXED SCALE

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeText(label, sx + 2, 14);

  ctx.fillStyle = 'rgba(228, 13, 235, 0.6)';
  ctx.fillText(label, sx + 2, 14);
}
ctx.textAlign = 'right';

for (let gy = Math.floor(startWY / minorGrid) * minorGrid; gy < endWY; gy += minorGrid) {
  if (gy % majorGrid === 0) continue;

  const [, sy] = worldToScreen(startWX, gy);

  const label = (gy).toFixed(0); // ✅ FIXED SCALE

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeText(label, 30, sy - 2);

  ctx.fillStyle = 'rgba(228, 13, 235, 0.6)';
  ctx.fillText(label, 30, sy - 2);
}

  // Sector labels (name, long × 1000, lat × 1000)
  const SECTOR_LABELS = [
    ['Central Jungle', 110, -70],//['Jungle I Sector', 94910, -74000],
    ['River Delta', 168, 32],//['River Delta', 910, -168000],
    ['Water Access', 85, -250],//['Water Access', 56000, -214000],
    ['Northern Jungle', 161, -305],//['Northern Jungle', 181000, -359000],
    ['East Jungle', 390, -125], //['East Swamp', 471000, -134000],
    ['The Swamps', 35, 300],
    ['North Plains', 360, -305],//['North Lake', 326000, -374000],
    ['South Plains', -280, 275],//['South Plains', -124000, 171000],
    ['West Jungle', -220, 110],//['West Rail Access', -239000, 31000],
    ['Highlands', -100, -65],
    ['Ridges', -150, -225],
  ];
  if (showSectorLabels) {
    ctx.font = 'bold 15px Fredoka One';
    ctx.textAlign = 'center';
    for (const [label, lng, lat] of SECTOR_LABELS) {
      const [sx, sy] = worldToScreen(lng, lat);
      ctx.strokeStyle = 'rgba(247, 14, 14, 0.94)';
      ctx.lineWidth = 4;
      ctx.strokeText(label, sx, sy);
      ctx.fillStyle = 'rgba(250, 252, 176, 0.95)';
      ctx.fillText(label, sx, sy);
    }
  }

  // Sector labels (name, long × 1000, lat × 1000)
  const EXTRA_LABELS = [
    ['West Coast', -410, 25],
    ['Mud Flats', -325, 150],
    ['The Pit', -362, 320],
    ['Southern Beach (West)', -60, 400],
    ['Southern Beach (East)', 100, 380],
    ['Tide Pool', 461, 50],
    ['NE. Cape', 450, -425],
    ['Mystery Island', -275, -345],
    ['Plains Fork', 150, -125],
  ];

  if (showExtraLabels) {
    ctx.font = 'bold 9px Fredoka One';
    ctx.textAlign = 'center';
    for (const [label, lng, lat] of EXTRA_LABELS) {
      const [sx, sy] = worldToScreen(lng, lat);
      ctx.strokeStyle = 'rgba(5, 139, 83, 0.6)';
      ctx.lineWidth = 4;
      ctx.strokeText(label, sx, sy);
      ctx.fillStyle = 'rgba(178, 255, 203, 0.95)';
      ctx.fillText(label, sx, sy);
    }
  }


  // Building labels (smaller, less prominent)
  const BUILDING_LABELS = [
    ['Port', 518, -275],
    ['Volcano Bunker', 273, -270],
    ['I12', 87, -100],
    ['K15', 254, 20],
    ['Swamp Tunnel', 125, 125],
    ['Entrance', 35, 95],
    ['Perimeter', -45, 105],
  ];

  if (showBuildingLabels) {
    ctx.font = '11px Fredoka One';
    ctx.textAlign = 'center';
    for (const [label, lng, lat] of BUILDING_LABELS) {
      const [sx, sy] = worldToScreen(lng, lat);
      ctx.strokeStyle = 'rgba(143, 50, 180, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, sx, sy);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillText(label, sx, sy);
    }
  }

  // Water labels (smaller, less prominent)
  const WATER_LABELS = [
    ['North Delta Bay', 75, -375],
    ['North East Delta Bay', 446, 85],
    ['South East Delta Bay', 251, 250],
    ['West Delta Bay', -445, 155],
    ['South Delta Bay', -264, 440],
  ];

  if (showWaterLabels) {
    ctx.font = '11px Fredoka One';
    ctx.textAlign = 'center';
    for (const [label, lng, lat] of WATER_LABELS) {
      const [sx, sy] = worldToScreen(lng, lat);
      ctx.strokeStyle = 'rgba(1, 5, 243, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, sx, sy);
      ctx.fillStyle = 'rgba(199, 208, 255, 0.95)';
      ctx.fillText(label, sx, sy);
    }
  }
 // Lake labels (smaller, less prominent)
  const LAKE_LABELS = [
    ['North Lake', 325, -365],
    ['Plains River', 371, -260],
    ['Hallow Falls', 351, -175],
    ['Delta River Fork', 215, -77],

    ['Dam Lake', 65, -270],
    ['Verdant Pond', 161, -252],
    ['Cascades', 181, -174],
    ['Forks Pond', 251, -175],

    ['HighLand Lake (North)', -29, -127],
    ['HighLand Lake (South)', -73, -90],
    ['Landslide Lake', -258, -95],
    ['West Pond', -300, -5],

    ['Swamp Lake (West)', -35, 286],
    ['Swamp Lake (East)', 96, 265],

    ['Endorheic', 175, 185],
    ['Jungle Pond', 85, 0],
    ['Coastal Pond', 339, 75],

    ['East Lake (North)', 465, -155],
    ['East Lake (South)', 465, -105],
  ];

  if (showLakeLabels) {
    ctx.font = `8px Fredoka One`;
    ctx.textAlign = 'center';
    for (const [label, lng, lat] of LAKE_LABELS) {
      const [sx, sy] = worldToScreen(lng, lat);
      ctx.strokeStyle = 'rgba(1, 5, 243, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeText(label, sx, sy);
      ctx.fillStyle = 'rgba(182, 252, 248, 0.95)';
      ctx.fillText(label, sx, sy);
    }
  }

  // Draw all players
  for (const [id, p] of players) {
    const color = p.color || '#c60feb';
    const isLocal = id === playerId;

    // Trail line (trail stores [lat, long], worldToScreen takes (long, lat))
    if (p.trail.length > 1) {
      ctx.strokeStyle = hexToRgba(color, 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const [sx0, sy0] = worldToScreen(p.trail[0][1], p.trail[0][0]);
      ctx.moveTo(sx0, sy0);
      for (let i = 1; i < p.trail.length; i++) {
        const [sx, sy] = worldToScreen(p.trail[i][1], p.trail[i][0]);
        ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Trail dots (last 50)
      for (let i = Math.max(0, p.trail.length - 50); i < p.trail.length; i++) {
        const [sx, sy] = worldToScreen(p.trail[i][1], p.trail[i][0]);
        const alpha = (i - p.trail.length + 50) / 50;
        ctx.fillStyle = hexToRgba(color, Math.max(0.1, alpha * 0.6));
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Position marker (long=horizontal, lat=vertical)
    if (p.lat != null && p.long != null) {
      const [px, py] = worldToScreen(p.long, p.lat);

        // Blinking halo for visibility (black pulse)
        const pulse = (Math.sin(Date.now() / 400 + (isLocal ? 0 : 2)) + 1) / 2; // 0-1
        const haloRadius = (isLocal ? 22 : 18) + pulse * 8;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.arc(px, py, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // White border ring around pulse (matches reference)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + pulse * 0.25})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, haloRadius + 2, 0, Math.PI * 2);
        ctx.stroke();

        // Static dark glow under inner dot
        ctx.fillStyle = `rgba(0, 0, 0, 0.25)`;
        ctx.beginPath();
        ctx.arc(px, py, isLocal ? 16 : 12, 0, Math.PI * 2);
        ctx.fill();

        // Inner core (player color for visibility)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, isLocal ? 6 : 5, 0, Math.PI * 2);
        ctx.fill();

        // Sharp white inner edge
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(px, py, isLocal ? 7 : 6, 0, Math.PI * 2);
        ctx.stroke();

      // Name label
      ctx.fillStyle = color;
      ctx.font = '11px Fredoka One';
      ctx.textAlign = 'center';
      const ago = p.lastUpdate ? formatAgo(Date.now() - p.lastUpdate) : '';
      ctx.fillText(p.name + (ago ? '  ' + ago : ''), px, py - 16);
    }
  }

  // Waypoints
  for (const [id, wp] of waypoints) {
    const p = players.get(id);
    if (!p || wp.lat == null) continue;
    const color = p.color || '#5ccfe6';
    const [wx, wy] = worldToScreen(wp.long, wp.lat);
    const pulse = (Math.sin(Date.now() / 300) + 1) / 2;

    // Pulsing outer ring
    const ringRadius = 12 + pulse * 6;
    ctx.strokeStyle = hexToRgba(color, 0.3 + pulse * 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, wy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner diamond shape
    const size = 8;
    ctx.fillStyle = hexToRgba(color, 0.8);
    ctx.beginPath();
    ctx.moveTo(wx, wy - size);
    ctx.lineTo(wx + size, wy);
    ctx.lineTo(wx, wy + size);
    ctx.lineTo(wx - size, wy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.font = '10px Fredoka One';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeText(p.name + "'s waypoint", wx, wy - 20);
    ctx.fillStyle = color;
    ctx.fillText(p.name + "'s waypoint", wx, wy - 20);

    // Dashed line from player to waypoint
    if (p.lat != null && p.long != null) {
      const [px, py] = worldToScreen(p.long, p.lat);
      ctx.strokeStyle = hexToRgba(color, 0.25);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(wx, wy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Hint text
  const local = players.get(playerId);
  if (!local || local.lat == null) {
    ctx.fillStyle = '#1fc6fa';
    ctx.font = '14px Fredoka One';
    ctx.textAlign = 'center';
    ctx.fillText('Share your screen and press Tab in-game', canvas.width / 2, 30);
  }

// Cursor coordinates
if (mouseOnCanvas) {
  const coordText = `${mouseWorldY.toFixed(0)}, ${mouseWorldX.toFixed(0)}`;

  ctx.font = 'bold 13px Fredoka One';
  ctx.textAlign = 'center';

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeText(coordText, canvas.width / 2, canvas.height - 12);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillText(coordText, canvas.width / 2, canvas.height - 12);
}


  // Auto-center on local player (X=Long, Y=Lat)
  if (autoCenter && local && local.lat != null && local.long != null) {
    viewX = -local.long;
    viewY = -local.lat;
  }

  requestAnimationFrame(draw);
}

// ── Overlay Toggles ──

function toggleMigration() {
  showMigration = !showMigration;
  const btn = document.getElementById('toggle-migration');
  btn.classList.toggle('active-capture', showMigration);
}

function toggleSanctuaries() {
  showSanctuaries = !showSanctuaries;
  const btn = document.getElementById('toggle-sanctuaries');
  btn.classList.toggle('active-capture', showSanctuaries);
}

function toggleMud() {
  showMud = !showMud;
  const btn = document.getElementById('toggle-mud');
  btn.classList.toggle('active-capture', showMud);
}

function toggleStructures() {
  showStructures = !showStructures;
  const btn = document.getElementById('toggle-structures');
  btn.classList.toggle('active-capture', showStructures);
}

function togglePatrolZones() {
  showPatrolZones = !showPatrolZones;
  const btn = document.getElementById('toggle-patrolzones');
  btn.classList.toggle('active-capture', showPatrolZones);
}

function toggleSectorLabels() {
  showSectorLabels = !showSectorLabels;
  const btn = document.getElementById('toggle-sector-labels');
  btn.classList.toggle('active-capture', showSectorLabels);
}

function toggleBuildingLabels() {
  showBuildingLabels = !showBuildingLabels;
  const btn = document.getElementById('toggle-building-labels');
  btn.classList.toggle('active-capture', showBuildingLabels);
}

function toggleWaterLabels() {
  showWaterLabels = !showWaterLabels;
  const btn = document.getElementById('toggle-water-labels');
  btn.classList.toggle('active-capture', showWaterLabels);
}

function toggleLakeLabels() {
  showLakeLabels = !showLakeLabels;
  const btn = document.getElementById('toggle-lake-labels');
  btn.classList.toggle('active-capture', showLakeLabels);
}

function toggleExtraLabels() {
  showExtraLabels = !showExtraLabels;
  const btn = document.getElementById('toggle-extra-labels');
  btn.classList.toggle('active-capture', showExtraLabels);
}

function toggleSalt() {
  showSalt = !showSalt;
  const btn = document.getElementById('toggle-salt');
  btn.classList.toggle('active-capture', showSalt);
}
function toggleGastro() {
  showGastro = !showGastro;
  const btn = document.getElementById('toggle-gastro');
  btn.classList.toggle('active-capture', showGastro);
}

function toggleAllMapAreaLabels() {
  // Check if all are currently on
  const allOn = showSectorLabels && showBuildingLabels && showExtraLabels;
  
  // Toggle all to opposite state
  showSectorLabels = !allOn;
  showBuildingLabels = !allOn;
  showExtraLabels = !allOn;
  
  // Update button states
  document.getElementById('toggle-sector-labels').classList.toggle('active-capture', showSectorLabels);
  document.getElementById('toggle-building-labels').classList.toggle('active-capture', showBuildingLabels);
  document.getElementById('toggle-extra-labels').classList.toggle('active-capture', showExtraLabels);
  document.getElementById('check-all-labels').checked = !allOn;
}

function toggleAllWaterLabels() {
  // Check if all are currently on
  const allOn = showWaterLabels && showLakeLabels;
  
  // Toggle all to opposite state
  showWaterLabels = !allOn;
  showLakeLabels = !allOn;
  
  // Update button states
  document.getElementById('toggle-water-labels').classList.toggle('active-capture', showWaterLabels);
  document.getElementById('toggle-lake-labels').classList.toggle('active-capture', showLakeLabels);
  document.getElementById('check-all-water-labels').checked = !allOn;
}

function toggleAllMapOverlays() {
  // Check if all are currently on
  const allOn = showMigration && showSanctuaries && showStructures && showPatrolZones && showMud;
  
  // Toggle all to opposite state
  showMigration = !allOn;
  showSanctuaries = !allOn;
  showStructures = !allOn;
  showPatrolZones = !allOn;
  showMud = !allOn;
  
  // Update button states
  document.getElementById('toggle-migration').classList.toggle('active-capture', showMigration);
  document.getElementById('toggle-sanctuaries').classList.toggle('active-capture', showSanctuaries);
  document.getElementById('toggle-structures').classList.toggle('active-capture', showStructures);
  document.getElementById('toggle-patrolzones').classList.toggle('active-capture', showPatrolZones);
  document.getElementById('toggle-mud').classList.toggle('active-capture', showMud);
  document.getElementById('check-all-overlays').checked = !allOn;
}

function toggleAllFoodOverlays() {
  const allOn = showBoar && showBunny && showChicken && showDeer && showGoat;

  showBoar = !allOn;
  showBunny = !allOn;
  showChicken = !allOn;
  showDeer = !allOn;
  showGoat = !allOn;

  document.getElementById('toggle-boar').classList.toggle('active-capture', showBoar);
  document.getElementById('toggle-bunny').classList.toggle('active-capture', showBunny);
  document.getElementById('toggle-chicken').classList.toggle('active-capture', showChicken);
  document.getElementById('toggle-deer').classList.toggle('active-capture', showDeer);
  document.getElementById('toggle-goat').classList.toggle('active-capture', showGoat);

  document.getElementById('check-all-food').checked = !allOn;
}
function toggleAllOceanFood() {
  const allOn = showFish && showCrab && showFrog && showTurtle;

  showFish = !allOn;
  showCrab = !allOn;
  showFrog = !allOn;
  showTurtle = !allOn;

  document.getElementById('toggle-fish').classList.toggle('active-capture', showFish);
  document.getElementById('toggle-crab').classList.toggle('active-capture', showCrab);
  document.getElementById('toggle-frog').classList.toggle('active-capture', showFrog);
  document.getElementById('toggle-turtle').classList.toggle('active-capture', showTurtle);
  
  document.getElementById('check-all-ocean-food').checked = !allOn;
}


function toggleAllEarthworks() {
  const allOn = showSalt && showGastro;

  showSalt = !allOn;
  showGastro = !allOn;

  document.getElementById('toggle-salt').classList.toggle('active-capture', showSalt);
  document.getElementById('toggle-gastro').classList.toggle('active-capture', showGastro);
  
  document.getElementById('check-all-earth-works').checked = !allOn;
}


// Initialize checkbox states on page load
function initializeCheckboxes() {
  document.getElementById('check-all-labels').checked = showSectorLabels && showBuildingLabels && showExtraLabels;
  document.getElementById('check-all-water-labels').checked = showWaterLabels && showLakeLabels;
  document.getElementById('check-all-overlays').checked = showMigration && showSanctuaries && showStructures && showPatrolZones && showMud;
  document.getElementById('check-all-food').checked = showBoar && showBunny && showChicken && showDeer && showGoat;

  // 🔥 ADD THIS
  document.getElementById('check-all-ocean-food').checked = showFish && showCrab && showFrog && showTurtle;
    // 🔥 ADD THIS
  document.getElementById('check-all-earth-works').checked = showSalt && showGastro;
}


// Call on page load if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCheckboxes);
} else {
  initializeCheckboxes();
}

function toggleBoar() {
  showBoar = !showBoar;
  const btn = document.getElementById('toggle-boar');
  btn.classList.toggle('active-capture', showBoar);
}

function toggleBunny() {
  showBunny = !showBunny;
  const btn = document.getElementById('toggle-bunny');
  btn.classList.toggle('active-capture', showBunny);
}

function toggleChicken() {
  showChicken = !showChicken;
  const btn = document.getElementById('toggle-chicken');
  btn.classList.toggle('active-capture', showChicken);
}

function toggleDeer() {
  showDeer = !showDeer;
  const btn = document.getElementById('toggle-deer');
  btn.classList.toggle('active-capture', showDeer);
}
function toggleGoat() {
  showGoat = !showGoat;
  const btn = document.getElementById('toggle-goat');
  btn.classList.toggle('active-capture', showGoat);
}

function toggleFrog() {
  showFrog = !showFrog;
  const btn = document.getElementById('toggle-frog');
  btn.classList.toggle('active-capture', showFrog);
}

function toggleCrab() {
  showCrab = !showCrab;
  const btn = document.getElementById('toggle-crab');
  btn.classList.toggle('active-capture', showCrab);
}

function toggleTurtle() {
  showTurtle = !showTurtle;
  const btn = document.getElementById('toggle-turtle');
  btn.classList.toggle('active-capture', showTurtle);
}
function toggleFish() {
  showFish = !showFish;
  const btn = document.getElementById('toggle-fish');
  btn.classList.toggle('active-capture', showFish);
}

// ── Keyboard shortcuts ──
document.getElementById('room-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom();
});
document.getElementById('player-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const joinSection = document.getElementById('join-section');
    if (joinSection.style.display === 'block') {
      document.getElementById('room-code-input').focus();
    }
  }
});
document.getElementById('manual-coords').addEventListener('keydown', e => {
  if (e.key === 'Enter') applyManualCoords();
});
