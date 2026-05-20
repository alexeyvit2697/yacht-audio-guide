// Если приложение открыто внутри Telegram, красиво разворачиваем его на весь экран
if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

// Точки маршрута.
// ВАЖНО: координаты сейчас примерные. Потом заменим на реальные точки вашего маршрута.
const points = [
  {
    id: 1,
    title: "Старт у марины",
    lat: 44.826150,
    lng: 20.424378,
    radius: 180,
    audio: "audio/01-intro.mp3",
    note: "Включить приветственный трек, когда гости уже на борту."
  },
  {
    id: 2,
    title: "Калемегдан",
    lat: 44.8248,
    lng: 20.4505,
    radius: 180,
    audio: "audio/02-kalemegdan.mp3",
    note: "Включить, когда крепость хорошо видна с воды."
  },
  {
    id: 3,
    title: "Слияние Савы и Дуная",
    lat: 44.49557,
    lng: 20.26598,
    radius: 200,
    audio: "audio/03-confluence.mp3",
    note: "Включить перед выходом к месту, где встречаются две реки."
  },
  {
    id: 4,
    title: "Велико Ратно Острво",
    lat: 44.8352,
    lng: 20.4372,
    radius: 220,
    audio: "audio/04-war-island.mp3",
    note: "Включить, когда остров появляется по курсу."
  },
  {
    id: 5,
    title: "Земун",
    lat: 44.8465,
    lng: 20.4129,
    radius: 220,
    audio: "audio/05-zemun.mp3",
    note: "Включить, когда видна набережная Земуна."
  },
  {
    id: 6,
    title: "Закатная точка",
    lat: 44.8398,
    lng: 20.4213,
    radius: 250,
    audio: "audio/06-sunset.mp3",
    note: "Включить ближе к финалу прогулки, когда свет становится мягким."
  }
];

const startButton = document.getElementById("startButton");
const statusTitle = document.getElementById("statusTitle");
const statusText = document.getElementById("statusText");

const alertCard = document.getElementById("alertCard");
const alertTitle = document.getElementById("alertTitle");
const alertNote = document.getElementById("alertNote");
const audioPlayer = document.getElementById("audioPlayer");
const markPlayedButton = document.getElementById("markPlayedButton");
const pointsList = document.getElementById("pointsList");

let map;
let userMarker;
let activePointId = null;
let playedPointIds = new Set();

// Центр карты: Белград, район рек
const defaultCenter = [44.828, 20.438];

function initMap() {
  map = L.map("map").setView(defaultCenter, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  points.forEach((point) => {
    L.marker([point.lat, point.lng])
      .addTo(map)
      .bindPopup(`<strong>${point.title}</strong><br>${point.note}`);

    L.circle([point.lat, point.lng], {
      radius: point.radius
    }).addTo(map);
  });
}

function renderPointsList() {
  pointsList.innerHTML = "";

  points.forEach((point) => {
    const isPlayed = playedPointIds.has(point.id);

    const pointElement = document.createElement("article");
    pointElement.className = `point ${isPlayed ? "played" : ""}`;

    pointElement.innerHTML = `
      <h3>${point.id}. ${point.title}</h3>
      <p>${point.note}</p>
      <div class="point-meta">Радиус уведомления: ${point.radius} м</div>
      <button class="point-button" data-point-id="${point.id}">
        ▶ Включить этот трек вручную
      </button>
    `;

    pointsList.appendChild(pointElement);
  });

  document.querySelectorAll(".point-button").forEach((button) => {
    button.addEventListener("click", () => {
      const pointId = Number(button.dataset.pointId);
      const point = points.find((item) => item.id === pointId);
      showPointAlert(point);
    });
  });
}

function startTour() {
  if (!navigator.geolocation) {
    statusTitle.textContent = "Геолокация не поддерживается";
    statusText.textContent = "Открой приложение на телефоне с включенной геолокацией.";
    return;
  }

  statusTitle.textContent = "Запрашиваю геолокацию";
  statusText.textContent = "Разреши доступ к местоположению. Без этого приложение не поймет, где находится яхта.";

  navigator.geolocation.watchPosition(
    handlePosition,
    handleGeoError,
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    }
  );
}

function handlePosition(position) {
  const userLat = position.coords.latitude;
  const userLng = position.coords.longitude;
  const accuracy = Math.round(position.coords.accuracy);

  statusTitle.textContent = "Тур запущен";
  statusText.textContent = `Геолокация работает. Точность: примерно ${accuracy} м. Держи страницу открытой.`;

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

  points.forEach((point) => {
    const distance = calculateDistanceInMeters(
      userLat,
      userLng,
      point.lat,
      point.lng
    );

    if (!nearest || distance < nearest.distance) {
      nearest = {
        point,
        distance
      };
    }
  });

  return nearest;
}

// Формула Haversine для расчета расстояния между координатами
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

  alertCard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

markPlayedButton.addEventListener("click", () => {
  if (activePointId) {
    playedPointIds.add(activePointId);
    renderPointsList();
    alertCard.classList.add("hidden");
    activePointId = null;
  }
});

startButton.addEventListener("click", startTour);

initMap();
renderPointsList();
