const routeSelect = document.getElementById("routeSelect");
const startButton = document.getElementById("startButton");
const testButton = document.getElementById("testButton");
const downloadButton = document.getElementById("downloadButton");
const resetButton = document.getElementById("resetButton");
const installButton = document.getElementById("installButton");
const autoplayToggle = document.getElementById("autoplayToggle");

const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");
const routeDescription = document.getElementById("routeDescription");

const alertCard = document.getElementById("alertCard");
const alertTitle = document.getElementById("alertTitle");
const alertNote = document.getElementById("alertNote");
const audioPlayer = document.getElementById("audioPlayer");
const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");
const markPlayedButton = document.getElementById("markPlayedButton");
const nextPointButton = document.getElementById("nextPointButton");
const pointsList = document.getElementById("pointsList");

let map;
let userMarker;
let pointObjects = [];
let watchId = null;
let deferredInstallPrompt = null;

let currentRouteKey = Object.keys(routes)[0];
let currentPointIndex = 0;
let activePointId = null;
let playedPointIds = new Set();
let audioUnlocked = false;

function init() {
  registerServiceWorker();
  setupInstallPrompt();
  fillRouteSelect();
  initMap();
  loadRoute(currentRouteKey);

  routeSelect.addEventListener("change", () => {
    stopGpsWatch();
    loadRoute(routeSelect.value);
  });

  startButton.addEventListener("click", startGpsTour);
  testButton.addEventListener("click", startTestMode);
  downloadButton.addEventListener("click", downloadCurrentRouteForOffline);
  resetButton.addEventListener("click", resetProgress);

  playButton.addEventListener("click", () => {
    audioUnlocked = true;
    audioPlayer.play().catch(showAudioPlayError);
  });

  pauseButton.addEventListener("click", () => audioPlayer.pause());
  markPlayedButton.addEventListener("click", markActivePointAsPlayed);
  nextPointButton.addEventListener("click", showNextPoint);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.classList.remove("hidden");
  });

  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.classList.add("hidden");
  });
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
  statusText.textContent = "Можно загрузить тур офлайн, включить GPS или проверить точки в тестовом режиме.";

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

    const circle = L.circle([point.lat, point.lng], { radius: point.radius }).addTo(map);
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
      <div class="point-meta">Радиус: ${point.radius} м · файл: ${point.audio}</div>
      <button class="point-button" data-point-index="${index}">▶ Открыть этот трек</button>
    `;

    pointsList.appendChild(pointElement);
  });

  document.querySelectorAll(".point-button").forEach((button) => {
    button.addEventListener("click", () => {
      const pointIndex = Number(button.dataset.pointIndex);
      currentPointIndex = pointIndex;
      showPointAlert(getCurrentPoints()[pointIndex], false);
    });
  });
}

async function startGpsTour() {
  audioUnlocked = true;

  if (!navigator.geolocation) {
    statusTitle.textContent = "Геолокация не поддерживается";
    statusText.textContent = "Открой приложение на телефоне с включенной геолокацией.";
    return;
  }

  stopGpsWatch();

  statusTitle.textContent = "Запрашиваю геолокацию";
  statusText.textContent = "Разреши доступ к местоположению. Держи приложение открытым во время прогулки.";

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
  audioUnlocked = true;
  currentPointIndex = 0;

  statusTitle.textContent = "Тестовый режим";
  statusText.textContent = "GPS выключен. Нажимай “Следующая точка”, чтобы проверить сценарий.";

  showPointAlert(getCurrentPoints()[currentPointIndex], true);
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
    showPointAlert(nearestPoint.point, autoplayToggle.checked);
  }
}

function handleGeoError(error) {
  statusTitle.textContent = "Не получилось получить геолокацию";

  if (error.code === 1) {
    statusText.textContent = "Доступ к геолокации запрещен. Разреши геолокацию в настройках телефона или браузера.";
  } else {
    statusText.textContent = "Проверь GPS и попробуй открыть приложение заново.";
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

function showPointAlert(point, shouldAutoplay) {
  activePointId = point.id;
  alertTitle.textContent = `${point.id}. ${point.title}`;
  alertNote.textContent = point.note;
  audioPlayer.src = point.audio;
  alertCard.classList.remove("hidden");
  alertCard.scrollIntoView({ behavior: "smooth", block: "start" });
  renderPointsList();

  if (shouldAutoplay && audioUnlocked) {
    audioPlayer.play().catch(showAudioPlayError);
  }
}

function showAudioPlayError() {
  statusTitle.textContent = "Автозапуск не сработал";
  statusText.textContent = "Браузер заблокировал автозапуск. Нажми “Включить” вручную. После этого следующие треки могут запускаться стабильнее.";
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

  showPointAlert(points[currentPointIndex], autoplayToggle.checked);
}

function resetProgress() {
  playedPointIds = new Set();
  activePointId = null;
  currentPointIndex = 0;
  alertCard.classList.add("hidden");
  renderPointsList();
  statusTitle.textContent = "Прогресс сброшен";
  statusText.textContent = "Можно начать маршрут заново.";
}

async function downloadCurrentRouteForOffline() {
  if (!("caches" in window)) {
    statusTitle.textContent = "Офлайн-режим не поддерживается";
    statusText.textContent = "Этот браузер не умеет сохранять файлы для офлайн-доступа.";
    return;
  }

  const route = getCurrentRoute();
  const audioFiles = route.points.map((point) => point.audio);

  const filesToCache = [
    "./",
    "index.html",
    "style.css",
    "app.js",
    "routes.js",
    "manifest.json",
    "service-worker.js",
    ...audioFiles
  ];

  statusTitle.textContent = "Загружаю тур офлайн";
  statusText.textContent = "Не закрывай приложение, пока файлы сохраняются.";

  try {
    const cache = await caches.open("yacht-audio-guide-offline-v3");

    for (let i = 0; i < filesToCache.length; i++) {
      statusText.textContent = `Сохраняю ${i + 1} из ${filesToCache.length}: ${filesToCache[i]}`;
      await cache.add(filesToCache[i]);
    }

    statusTitle.textContent = "Тур загружен офлайн";
    statusText.textContent = "Интерфейс и аудио этого маршрута сохранены. Перед выходом на воду проверь первый трек.";
  } catch (error) {
    statusTitle.textContent = "Не удалось загрузить офлайн";
    statusText.textContent = "Проверь, что все аудиофайлы загружены на сайт и пути в routes.js написаны правильно.";
  }
}

init();
