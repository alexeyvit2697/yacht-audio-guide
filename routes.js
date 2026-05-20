// Здесь редактируются маршруты, точки и аудио.
// Для офлайн-режима аудиофайлы должны лежать по тем же путям, что указаны в audio.

const routes = {
  sunset: {
    title: "Sunset Yacht Tour",
    description: "Вечерний маршрут по Саве и Дунаю с акцентом на виды, историю и закат.",
    center: [44.828, 20.438],
    zoom: 13,
    points: [
      {
        id: 1,
        title: "Старт у марины",
        lat: 44.8234,
        lng: 20.4489,
        radius: 180,
        audio: "audio/sunset/01-intro.mp3",
        note: "Включить приветственный трек, когда гости уже на борту."
      },
      {
        id: 2,
        title: "Калемегдан",
        lat: 44.8248,
        lng: 20.4505,
        radius: 180,
        audio: "audio/sunset/02-kalemegdan.mp3",
        note: "Включить, когда крепость хорошо видна с воды."
      },
      {
        id: 3,
        title: "Слияние Савы и Дуная",
        lat: 44.8261,
        lng: 20.4436,
        radius: 220,
        audio: "audio/sunset/03-confluence.mp3",
        note: "Включить перед выходом к месту, где встречаются две реки."
      },
      {
        id: 4,
        title: "Велико Ратно Острво",
        lat: 44.8352,
        lng: 20.4372,
        radius: 240,
        audio: "audio/sunset/04-war-island.mp3",
        note: "Включить, когда остров появляется по курсу."
      }
    ]
  },

  morning: {
    title: "Morning Yacht Tour",
    description: "Утренний маршрут: спокойная версия тура с короткими треками и мягким темпом.",
    center: [44.828, 20.438],
    zoom: 13,
    points: [
      {
        id: 1,
        title: "Утренний старт",
        lat: 44.8234,
        lng: 20.4489,
        radius: 180,
        audio: "audio/morning/01-intro.mp3",
        note: "Включить, когда гости устроились на борту."
      },
      {
        id: 2,
        title: "Калемегдан утром",
        lat: 44.8248,
        lng: 20.4505,
        radius: 180,
        audio: "audio/morning/02-kalemegdan.mp3",
        note: "Включить, когда крепость появляется в хорошем обзоре."
      }
    ]
  }
};
