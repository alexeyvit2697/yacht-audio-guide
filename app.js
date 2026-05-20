if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

const routeSelect = document.getElementById("routeSelect");
const startButton = document.getElementById("startButton");
const testButton = document.getElementById("testButton");

const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const routeDescription = document.getElementById("routeDescription");

const alertCard = document.getElementById("alertCard");
const alertTitle = document.getElementById("alertTitle");
const alertNote = document.getElementById("alertNote");
const audioPlayer = document.getElementById("audioPlayer");
const markPlayedButton = document.getElementById("markPlayedButton");
const nextPointButton = document.getElementById("nextPointButton");
const pointsList = document.getElementById("pointsList");

let map;
let userMarker;
let pointObjects = [];
let watchId = null;

let currentRouteKey = Object.keys(routes)[0];
let currentPointIndex = 0;
let activePointId = null;
let playedPointIds = new Set();

function init() {
  fillRouteSelect();
  initMap();
  loadRoute(currentRouteKey);

  routeSelect.addEventListener("change", () => {
    stopGpsWatch();
    loadRoute(routeSelect.value);
  });

  startButton.addEventListener("click", startGpsTour);
  testButton.addEventListener("click", startTestMode);
  markPlayedButton.addEventListener("click", markActivePointAsPlayed);
  nextPointButton.addEventListener("click", showNextPoint);
}

function fillRouteSelect() {
  Object.entries(routes).forEach(([key, route]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = route.title;
    routeSelect.appendChild(option);
  });
}

function initMap() {
  map = L.map("map").setView([44.828, 20.438], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);
}

function loadRoute(routeKey) {
  currentRouteKey = routeKey;
  currentPointIndex = 0;
  activePointId = null;
  playedPointIds = new Set();

  const route = getCurrentRoute();

  routeDescription.textContent = route.description;
  statusTitle.textContent = `Маршрут: ${route.title}`;
  statusText.textContent = "Можно начать GPS-тур или проверить точки в тестовом режиме.";

  alertCard.classList.add("hidden");
  audioPlayer.pause();
  audioPlayer.removeAttribute("src");

  clearMapObjects();
  drawRouteOnMap();
  renderPointsList();

  map.setView(route.center, route.zoom);
}

function getCurrentRoute() {
  return routes[currentRouteKey];
}

function getCurrentPoints() {
  return getCurrentRoute().points;
}

function clearMapObjects() {
  pointObjects.forEach((object) => object.remove());
  pointObjects = [];
}

function drawRouteOnMap() {
  const points = getCurrentPoints();

  points.forEach((point) => {
    const marker = L.marker([point.lat, point.lng])
      .addTo(map)
      .bindPopup(`<strong>${point.id}. ${point.title}</strong><br>${point.note}`);

    const circle = L.circle([point.lat, point.lng], {
      radius: point.radius
    }).addTo(map);

    pointObjects.push(marker, circle);
  });

  const line = points.map((point) => [point.lat, point.lng]);

  if (line.length > 1) {
    const polyline = L.polyline(line).addTo(map);
    pointObjects.push(polyline);
  }
}

function renderPointsList() {
  const points = getCurrentPoints();
  pointsList.innerHTML = "";

  points.forEach((point, index) => {
    const isPlayed = playedPointIds.has(point.id);
    const isActive = activePointId === point.id;

    const pointElement = document.createElement("article");
    pointElement.className = `point ${isPlayed ? "played" : ""} ${isActive ? "active" : ""}`;

    pointElement.innerHTML = `
      <h3>${point.id}. ${point.title}</h3>
      <p>${point.note}</p>
      <div class="point-meta">Радиус уведомления: ${point.radius} м</div>
      <button class="point-button" data-point-index="${index}">
        ▶ Включить этот трек
      </button>
    `;

    pointsList.appendChild(pointElement);
  });

  document.querySelectorAll(".point-button").forEach((button) => {
    button.addEventListener("click", () => {
      const pointIndex = Number(button.dataset.pointIndex);
      currentPointIndex = pointIndex;
      showPointAlert(getCurrentPoints()[pointIndex]);
    });
  });
}

function startGpsTour() {
  if (!navigator.geolocation) {
    statusTitle.textContent = "Геолокация не поддерживается";
    statusText.textContent = "Открой приложение на телефоне с включенной геолокацией.";
    return;
  }

  stopGpsWatch();

  statusTitle.textContent = "Запрашиваю геолокацию";
  statusText.textContent = "Разреши доступ к местоположению. Держи страницу открытой во время прогулки.";

  watchId = navigator.geolocation.watchPosition(handlePosition, handleGeoError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000
  });
}

function stopGpsWatch() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

function startTestMode() {
  stopGpsWatch();
  currentPointIndex = 0;

  statusTitle.textContent = "Тестовый режим";
  statusText.textContent = "GPS выключен. Нажимай “Следующая точка”, чтобы проверить сценарий.";

  showPointAlert(getCurrentPoints()[currentPointIndex]);
}

function handlePosition(position) {
  const userLat = position.coords.latitude;
  const userLng = position.coords.longitude;
  const accuracy = Math.round(position.coords.accuracy);

  statusTitle.textContent = "GPS-тур запущен";
  statusText.textContent = `Геолокация работает. Точность: примерно ${accuracy} м.`;

  const userLatLng = [userLat, userLng];

  if (!userMarker) {
    userMarker = L.marker(userLatLng).addTo(map).bindPopup("Вы здесь");
    map.setView(userLatLng, 14);
  } else {
    userMarker.setLatLng(userLatLng);
  }

  const nearestPoint = findNearestPoint(userLat, userLng);

  if (
    nearestPoint &&
    nearestPoint.distance <= nearestPoint.point.radius &&
    !playedPointIds.has(nearestPoint.point.id) &&
    activePointId !== nearestPoint.point.id
  ) {
    currentPointIndex = nearestPoint.index;
    showPointAlert(nearestPoint.point);
  }
}

function handleGeoError(error) {
  statusTitle.textContent = "Не получилось получить геолокацию";

  if (error.code === 1) {
    statusText.textContent = "Доступ к геолокации запрещен. Разреши геолокацию в настройках браузера или Telegram.";
  } else {
    statusText.textContent = "Проверь интернет, GPS и попробуй открыть приложение заново.";
  }
}

function findNearestPoint(userLat, userLng) {
  let nearest = null;

  getCurrentPoints().forEach((point, index) => {
    const distance = calculateDistanceInMeters(userLat, userLng, point.lat, point.lng);

    if (!nearest || distance < nearest.distance) {
      nearest = { point, distance, index };
    }
  });

  return nearest;
}

function calculateDistanceInMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function showPointAlert(point) {
  activePointId = point.id;

  alertTitle.textContent = `${point.id}. ${point.title}`;
  alertNote.textContent = point.note;
  audioPlayer.src = point.audio;

  alertCard.classList.remove("hidden");

  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
  }

  alertCard.scrollIntoView({ behavior: "smooth", block: "start" });
  renderPointsList();
}

function markActivePointAsPlayed() {
  if (!activePointId) return;

  playedPointIds.add(activePointId);
  renderPointsList();
  alertCard.classList.add("hidden");
}

function showNextPoint() {
  const points = getCurrentPoints();

  if (currentPointIndex < points.length - 1) {
    currentPointIndex += 1;
  } else {
    currentPointIndex = 0;
  }

  showPointAlert(points[currentPointIndex]);
}

init();
