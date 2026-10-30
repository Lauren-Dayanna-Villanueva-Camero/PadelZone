import { useState, useEffect, useCallback } from 'react'
import './Weather.css'

const LATITUDE = 2.9273
const LONGITUDE = -75.2819

const WMO_CODES = {
  0: { desc: 'Cielo despejado', icon: '01d' },
  1: { desc: 'Principalmente despejado', icon: '02d' },
  2: { desc: 'Parcialmente nublado', icon: '03d' },
  3: { desc: 'Nublado', icon: '04d' },
  45: { desc: 'Neblina', icon: '50d' },
  48: { desc: 'Neblina con escarcha', icon: '50d' },
  51: { desc: 'Llovizna leve', icon: '09d' },
  53: { desc: 'Llovizna moderada', icon: '09d' },
  55: { desc: 'Llovizna intensa', icon: '09d' },
  61: { desc: 'Lluvia leve', icon: '10d' },
  63: { desc: 'Lluvia moderada', icon: '10d' },
  65: { desc: 'Lluvia intensa', icon: '10d' },
  80: { desc: 'Chubascos leves', icon: '09d' },
  81: { desc: 'Chubascos moderados', icon: '09d' },
  82: { desc: 'Chubascos intensos', icon: '09d' },
  95: { desc: 'Tormenta eléctrica', icon: '11d' },
  96: { desc: 'Tormenta con granizo', icon: '11d' },
  99: { desc: 'Tormenta fuerte con granizo', icon: '11d' },
}

const getWMO = (code) => WMO_CODES[code] || { desc: 'Desconocido', icon: '03d' }

const getWeatherAdvice = (code, temp) => {
  if ([95, 96, 99].includes(code))
    return { text: 'No recomendado jugar hoy - hay tormenta eléctrica. Canchas interiores.', icon: 'thunderstorm', color: '#e53935' }
  if ([51,53,55,61,63,65,80,81,82].includes(code))
    return { text: 'No recomendado jugar hoy - hay lluvia. Considera las canchas interiores.', icon: 'umbrella', color: '#e53935' }
  if ([2, 3].includes(code))
    return { text: 'Condiciones aceptables. Nublado pero se puede jugar sin problemas.', icon: 'cloud', color: '#fb8c00' }
  if (temp > 35)
    return { text: 'Mucho calor. Hidrátate bien y juega en horarios frescos (7-10AM o después de las 5PM).', icon: 'thermostat', color: '#fb8c00' }
  if ([0, 1].includes(code))
    return { text: '¡Condiciones perfectas para jugar! Aprovecha el día.', icon: 'wb_sunny', color: '#00897b' }
  return { text: 'Condiciones normales para jugar pádel.', icon: 'sports_tennis', color: '#010231' }
}

const getWeatherBg = (code) => {
  if ([95,96,99,51,53,55,61,63,65,80,81,82].includes(code))
    return 'linear-gradient(135deg, #37474f 0%, #546e7a 100%)'
  if ([2, 3].includes(code))
    return 'linear-gradient(135deg, #546e7a 0%, #78909c 100%)'
  return 'linear-gradient(135deg, #010231 0%, #0a7c5c 100%)'
}

const getDayName = (dateStr) => {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return days[new Date(dateStr + 'T12:00:00').getDay()]
}

function Weather() {
  const [current, setCurrent] = useState(null)
  const [forecast, setForecast] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchWeather = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,surface_pressure,visibility,cloud_cover,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=America%2FBogota&forecast_days=6`

      const res = await fetch(url)
      if (!res.ok) throw new Error('Error al conectar con Open-Meteo')
      const data = await res.json()

      const c = data.current
      setCurrent({
        temp: c.temperature_2m,
        feelsLike: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        windSpeed: c.wind_speed_10m,
        pressure: c.surface_pressure,
        // Open-Meteo la da en metros
        visibility: c.visibility != null ? Math.round(c.visibility / 100) / 10 : '—',
        clouds: c.cloud_cover,
        code: c.weather_code,
      })

      // Próximos 5 días (saltamos hoy, índice 0)
      const daily = data.daily
      const days = daily.time.slice(1, 6).map((date, i) => ({
        date,
        code: daily.weather_code[i + 1],
        tempMax: daily.temperature_2m_max[i + 1],
        tempMin: daily.temperature_2m_min[i + 1],
        rainProb: daily.precipitation_probability_max[i + 1],
      }))
      setForecast(days)

    } catch (err) {
      console.error(err)
      setError(`No se pudo cargar el clima: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al montar
    fetchWeather()
  }, [fetchWeather])

  const advice = current ? getWeatherAdvice(current.code, current.temp) : null
  const bg = current ? getWeatherBg(current.code) : 'linear-gradient(135deg, #010231 0%, #0a7c5c 100%)'
  const wmo = current ? getWMO(current.code) : null

  return (
    <div className="weather-page">
      <div className="weather-header" style={{ background: bg }}>
        <div className="container">
          <div className="weather-header-top">
            <div>
              <h1>Clima en Neiva</h1>
              <p>Condiciones para jugar pádel hoy</p>
            </div>
            <button className="weather-refresh-btn" onClick={fetchWeather}>
              <i className="material-icons">refresh</i>
              Actualizar
            </button>
          </div>

          {loading && (
            <div className="weather-loading">
              <i className="material-icons spinning">refresh</i>
              <span>Cargando clima...</span>
            </div>
          )}

          {error && (
            <div className="weather-error">
              <i className="material-icons">error_outline</i>
              {error}
            </div>
          )}

          {!loading && !error && current && wmo && (
            <div className="weather-current">
              <div className="weather-main">
                <img
                  src={`https://openweathermap.org/img/wn/${wmo.icon}@2x.png`}
                  alt={wmo.desc}
                  className="weather-icon"
                />
                <div>
                  <span className="weather-temp">{Math.round(current.temp)}°C</span>
                  <span className="weather-desc">{wmo.desc}</span>
                </div>
              </div>

              <div className="weather-details-grid">
                {[
                  { icon: 'thermostat', label: 'Sensación', value: `${Math.round(current.feelsLike)}°C` },
                  { icon: 'water_drop', label: 'Humedad', value: `${current.humidity}%` },
                  { icon: 'air', label: 'Viento', value: `${Math.round(current.windSpeed)} km/h` },
                  { icon: 'compress', label: 'Presión', value: `${Math.round(current.pressure)} hPa` },
                  { icon: 'visibility', label: 'Visibilidad', value: `${current.visibility} km` },
                  { icon: 'cloud', label: 'Nubosidad', value: `${current.clouds}%` },
                ].map(({ icon, label, value }) => (
                  <div className="weather-detail-item" key={label}>
                    <i className="material-icons">{icon}</i>
                    <div>
                      <p className="wd-label">{label}</p>
                      <p className="wd-value">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container weather-body">

        {!loading && !error && advice && (
          <div className="weather-advice" style={{ borderLeftColor: advice.color }}>
            <div className="weather-advice-icon" style={{ backgroundColor: advice.color }}>
              <i className="material-icons">{advice.icon}</i>
            </div>
            <div>
              <p className="weather-advice-title">Recomendación para jugar</p>
              <p className="weather-advice-text">{advice.text}</p>
            </div>
          </div>
        )}

        {!loading && !error && forecast.length > 0 && (
          <div className="weather-forecast-section">
            <h5>Pronóstico — Próximos 5 días</h5>
            <div className="weather-forecast-grid">
              {forecast.map((day, i) => {
                const d = getWMO(day.code)
                return (
                  <div className="forecast-card" key={i}>
                    <p className="forecast-day">{getDayName(day.date)}</p>
                    <img
                      src={`https://openweathermap.org/img/wn/${d.icon}@2x.png`}
                      alt={d.desc}
                      className="forecast-icon"
                    />
                    <p className="forecast-desc">{d.desc}</p>
                    <div className="forecast-temps">
                      <span className="forecast-max">{Math.round(day.tempMax)}°</span>
                      <span className="forecast-min">{Math.round(day.tempMin)}°</span>
                    </div>
                    <div className="forecast-humidity">
                      <i className="material-icons">water_drop</i>
                      {day.rainProb}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && !error && current && (
          <div className="weather-schedule-section">
            <h5>Mejores horarios para jugar hoy</h5>
            <div className="weather-schedule-grid">
              {[
                { time: '7:00 AM – 9:00 AM', icon: 'wb_twilight', label: 'Mañana temprano', desc: 'Fresco y tranquilo' },
                { time: '9:00 AM – 11:00 AM', icon: 'wb_sunny', label: 'Media mañana', desc: 'Temperatura ideal' },
                { time: '4:00 PM – 6:00 PM', icon: 'wb_cloudy', label: 'Tarde', desc: 'Menos calor' },
                { time: '7:00 PM – 9:00 PM', icon: 'nights_stay', label: 'Noche', desc: 'Fresco con iluminación LED' },
              ].map((slot, i) => (
                <div className="schedule-card" key={i}>
                  <i className="material-icons">{slot.icon}</i>
                  <p className="schedule-time">{slot.time}</p>
                  <p className="schedule-label">{slot.label}</p>
                  <p className="schedule-desc">{slot.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default Weather