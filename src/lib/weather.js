// Aaj ka mausam: Open-Meteo (free, bina key). Location ~1km tak round karke bhejte hain (privacy).
const CODES = { 0: 'saaf aasmaan', 1: 'halki dhoop', 2: 'thode badal', 3: 'badal', 45: 'kohra', 48: 'kohra', 51: 'halki boonda-baandi', 61: 'halki baarish', 63: 'baarish', 65: 'tez baarish', 80: 'bauchhar', 95: 'toofan/bijli' }

export async function todayWeather() {
  const pos = await new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Location permission nahi mili. Mausam khud likh do.')), { timeout: 10000, maximumAge: 3600000 }),
  )
  const lat = pos.coords.latitude.toFixed(2)
  const lon = pos.coords.longitude.toFixed(2)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Mausam nahi mila. Khud likh do.')
  const j = await res.json()
  const c = j.current, d = j.daily
  const sky = CODES[c.weather_code] || 'normal'
  return `Aaj ka mausam: abhi ${Math.round(c.temperature_2m)}°C, ${sky}, nami ${c.relative_humidity_2m}%, din mein ${Math.round(d.temperature_2m_min[0])}-${Math.round(d.temperature_2m_max[0])}°C, baarish ka chance ${d.precipitation_probability_max[0]}%`
}
