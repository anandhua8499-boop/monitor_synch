import {
  useEffect,
  useRef,
  useState,
} from 'react'

import ZoneEditor, {
  type Zone,
} from './ZoneEditor'

type ScreenSource = {
  id: string
  name: string
  thumbnail: string
}

type RGB = {
  r: number
  g: number
  b: number
}

type ZoneColor = RGB & {
  zoneId: number
}

const DEFAULT_WLED_IP = '192.168.1.3'

const LED_COUNT = 36

const PROCESS_FPS = 30
const WLED_FPS = 15
const UI_FPS = 10

const WLED_INTERVAL = 1000 / WLED_FPS
const UI_INTERVAL = 1000 / UI_FPS

const createBottomLedZones = (count = LED_COUNT): Zone[] => {
  const width = 100 / count

  // Default physical layout: 36 LEDs along the bottom edge,
  // wired left -> right (LED 0 on the left, LED 35 on the right).
  // The user can still edit every zone in ZoneEditor.
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    x: index * width,
    y: 82,
    width,
    height: 18,
    ledIndex: index,
  }))
}

const createDefaultZones = () =>
  createBottomLedZones(LED_COUNT)

function App() {
  // =====================================================
  // SCREEN
  // =====================================================

  const [sources, setSources] = useState<ScreenSource[]>([])
  const [selectedScreen, setSelectedScreen] = useState('')
  const [capturing, setCapturing] = useState(false)

  // =====================================================
  // RGB
  // =====================================================

  const [rgb, setRgb] = useState<RGB>({
    r: 0,
    g: 0,
    b: 0,
  })

  const [zones, setZones] = useState<Zone[]>(
    createDefaultZones(),
  )

  const [zoneColors, setZoneColors] = useState<
    ZoneColor[]
  >([])

  // =====================================================
  // SETTINGS
  // =====================================================

  const [brightness, setBrightness] = useState(1)
  const [fps, setFps] = useState(PROCESS_FPS)
  const [smoothness, setSmoothness] = useState(0.7)

  // =====================================================
  // WLED
  // =====================================================

  const [wledIp, setWledIp] = useState(
    DEFAULT_WLED_IP,
  )

  const [wledConnected, setWledConnected] =
    useState(false)

  const [wledSending, setWledSending] =
    useState(false)

  // =====================================================
  // ERROR
  // =====================================================

  const [error, setError] = useState('')

  // =====================================================
  // REFS
  // =====================================================

  const videoRef =
    useRef<HTMLVideoElement>(null)

  const canvasRef =
    useRef<HTMLCanvasElement>(null)

  const streamRef =
    useRef<MediaStream | null>(null)

  const animationRef =
    useRef<number | null>(null)

  const lastFrameRef = useRef(0)
  const lastWledUpdateRef = useRef(0)
  const lastUiUpdateRef = useRef(0)

  const previousColorsRef =
    useRef<ZoneColor[]>([])

  const zonesRef =
    useRef<Zone[]>(zones)

  const brightnessRef =
    useRef(brightness)

  const smoothnessRef =
    useRef(smoothness)

  const wledIpRef =
    useRef(wledIp)

  const wledConnectedRef =
    useRef(wledConnected)

  const wledRequestRef =
    useRef(false)

  const mountedRef =
    useRef(true)

  // Keep refs synchronized with React state.
  useEffect(() => {
    zonesRef.current = zones
  }, [zones])

  useEffect(() => {
    brightnessRef.current = brightness
  }, [brightness])

  useEffect(() => {
    smoothnessRef.current = smoothness
  }, [smoothness])

  useEffect(() => {
    wledIpRef.current = wledIp
  }, [wledIp])

  useEffect(() => {
    wledConnectedRef.current =
      wledConnected
  }, [wledConnected])

  // =====================================================
  // LOAD SCREENS
  // =====================================================

  const loadScreens = async () => {
    try {
      setError('')

      console.log(
        'Requesting screen sources...',
      )

      const screens =
        await window.ambiSync.getScreenSources()

      console.log(
        'SCREEN SOURCES:',
        screens,
      )

      console.log(
        'SCREEN COUNT:',
        screens.length,
      )

      if (!mountedRef.current) {
        return
      }

      setSources(screens)

      if (
        screens.length > 0 &&
        !selectedScreen
      ) {
        setSelectedScreen(
          screens[0].id,
        )
      }
    } catch (err) {
      console.error(
        'Screen detection failed:',
        err,
      )

      if (mountedRef.current) {
        setError(
          'Unable to detect displays.',
        )
      }
    }
  }

  // =====================================================
  // INITIALIZE
  // =====================================================

  useEffect(() => {
    mountedRef.current = true

    loadScreens()

    return () => {
      mountedRef.current = false
      stopCapture()
    }
  }, [])

  // =====================================================
  // BOTTOM LED LAYOUT
  // =====================================================

  const resetBottomLedLayout = () => {
    const bottomZones = createBottomLedZones(LED_COUNT)

    zonesRef.current = bottomZones
    setZones(bottomZones)
    previousColorsRef.current = []
    setZoneColors([])
  }

  // =====================================================
  // ZONE CHANGE
  // =====================================================

  const handleZonesChange = (
    updatedZones: Zone[],
  ) => {
    zonesRef.current = updatedZones
    setZones(updatedZones)

    // Reset smoothing because zone geometry
    // has changed.
    previousColorsRef.current = []
  }

  // =====================================================
  // GET RGB FROM USER DEFINED ZONE
  // =====================================================

  const getRGB = (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): RGB => {
    let r = 0
    let g = 0
    let b = 0
    let count = 0

    const startX = Math.max(
      0,
      Math.floor(x1),
    )

    const endX = Math.min(
      width,
      Math.ceil(x2),
    )

    const startY = Math.max(
      0,
      Math.floor(y1),
    )

    const endY = Math.min(
      height,
      Math.ceil(y2),
    )

    // Sample every 2 pixels.
    for (
      let y = startY;
      y < endY;
      y += 2
    ) {
      for (
        let x = startX;
        x < endX;
        x += 2
      ) {
        const index =
          (y * width + x) * 4

        r += data[index]
        g += data[index + 1]
        b += data[index + 2]

        count++
      }
    }

    if (count === 0) {
      return {
        r: 0,
        g: 0,
        b: 0,
      }
    }

    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
    }
  }

  // =====================================================
  // SMOOTH RGB
  // =====================================================

  const smoothColor = (
    current: RGB,
    previous: RGB,
    amount: number,
  ): RGB => {
    return {
      r: Math.round(
        previous.r +
          (current.r - previous.r) *
            amount,
      ),

      g: Math.round(
        previous.g +
          (current.g - previous.g) *
            amount,
      ),

      b: Math.round(
        previous.b +
          (current.b - previous.b) *
            amount,
      ),
    }
  }

  // =====================================================
  // SEND 36 ZONES TO WLED
  // 1 ZONE = 1 LED
  // =====================================================

  const sendZonesToWLED = async (
    currentColors: ZoneColor[],
  ) => {
    const ip = wledIpRef.current

    if (
      !ip ||
      currentColors.length === 0 ||
      wledRequestRef.current
    ) {
      return
    }

    wledRequestRef.current = true

    if (mountedRef.current) {
      setWledSending(true)
    }

    try {
      // Physical layout: LED 0 -> left, LED 35 -> right.
      // Each zone owns one physical LED through zone.ledIndex.
      // This keeps the physical WLED order independent from the
      // visual ZoneEditor geometry.
      const colors: number[][] =
        Array.from(
          { length: LED_COUNT },
          () => [0, 0, 0],
        )

      const configuredZones =
        zonesRef.current

      for (const color of currentColors) {
        const zone =
          configuredZones.find(
            (item) =>
              item.id === color.zoneId,
          )

        if (!zone) {
          continue
        }

        const ledIndex =
          Math.round(zone.ledIndex)

        if (
          ledIndex < 0 ||
          ledIndex >= LED_COUNT
        ) {
          continue
        }

        colors[ledIndex] = [
          color.r,
          color.g,
          color.b,
        ]
      }

      const ledColors = colors.flatMap(([r, g, b]) => [
  r,
  g,
  b,
])

const response = await fetch(
  `http://${ip}/json/state`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      on: true,
      bri: Math.round(
        brightnessRef.current * 255,
      ),
      seg: [
        {
          id: 0,
          start: 0,
          stop: LED_COUNT,
          frz: false,
          i: ledColors,
        },
      ],
    }),
  },
)
      console.log(
  'LED COLORS:',
  colors.length,
  colors,
)

      if (!response.ok) {
        throw new Error(
          `WLED HTTP ${response.status}`,
        )
      }

      if (mountedRef.current) {
        setWledConnected(true)
      }

      wledConnectedRef.current = true
    } catch (err) {
      console.error(
        'WLED zone update failed:',
        err,
      )

      wledConnectedRef.current = false

      if (mountedRef.current) {
        setWledConnected(false)
      }
    } finally {
      wledRequestRef.current = false

      if (mountedRef.current) {
        setWledSending(false)
      }
    }
  }

  // =====================================================
  // CALCULATE USER DEFINED ZONES
  // =====================================================

  const calculateZones = () => {
    const now =
      performance.now()

    const frameInterval =
      1000 / fps

    if (
      now - lastFrameRef.current <
      frameInterval
    ) {
      animationRef.current =
        requestAnimationFrame(
          calculateZones,
        )

      return
    }

    lastFrameRef.current = now

    const video =
      videoRef.current

    const canvas =
      canvasRef.current

    if (!video || !canvas) {
      animationRef.current =
        requestAnimationFrame(
          calculateZones,
        )

      return
    }

    if (
      video.readyState <
      HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      animationRef.current =
        requestAnimationFrame(
          calculateZones,
        )

      return
    }

    const configuredZones =
      zonesRef.current

    if (configuredZones.length === 0) {
      animationRef.current =
        requestAnimationFrame(
          calculateZones,
        )

      return
    }

    // Small processing canvas.
    const width = 120
    const height = 68

    canvas.width = width
    canvas.height = height

    const ctx =
      canvas.getContext(
        '2d',
        {
          willReadFrequently: true,
        },
      )

    if (!ctx) {
      animationRef.current =
        requestAnimationFrame(
          calculateZones,
        )

      return
    }

    ctx.drawImage(
      video,
      0,
      0,
      width,
      height,
    )

    const image =
      ctx.getImageData(
        0,
        0,
        width,
        height,
      )

    const data =
      image.data

    const rawColors: ZoneColor[] =
      configuredZones.map(
        (zone) => {
          const x1 =
            (zone.x / 100) *
            width

          const y1 =
            (zone.y / 100) *
            height

          const x2 =
            ((zone.x + zone.width) /
              100) *
            width

          const y2 =
            ((zone.y + zone.height) /
              100) *
            height

          const color =
            getRGB(
              data,
              width,
              height,
              x1,
              y1,
              x2,
              y2,
            )

          return {
            zoneId: zone.id,
            ...color,
          }
        },
      )

    // ===================================================
    // SMOOTH
    // ===================================================

    const previous =
      previousColorsRef.current

    const processedColors =
      rawColors.map(
        (color, index) => {
          const previousColor =
            previous[index]

          let smoothed: RGB

          if (previousColor) {
            smoothed =
              smoothColor(
                color,
                previousColor,
                smoothnessRef.current,
              )
          } else {
            smoothed = color
          }

          const brightnessValue =
            brightnessRef.current

          return {
            zoneId: color.zoneId,

            r: Math.max(
              0,
              Math.min(
                255,
                Math.round(
                  smoothed.r *
                    brightnessValue,
                ),
              ),
            ),

            g: Math.max(
              0,
              Math.min(
                255,
                Math.round(
                  smoothed.g *
                    brightnessValue,
                ),
              ),
            ),

            b: Math.max(
              0,
              Math.min(
                255,
                Math.round(
                  smoothed.b *
                    brightnessValue,
                ),
              ),
            ),
          }
        },
      )

    previousColorsRef.current =
      processedColors

    // ===================================================
    // UI UPDATE
    // ===================================================

    if (
      now -
        lastUiUpdateRef.current >=
      UI_INTERVAL
    ) {
      lastUiUpdateRef.current =
        now

      if (mountedRef.current) {
        setZoneColors(
          processedColors,
        )

        let totalR = 0
        let totalG = 0
        let totalB = 0

        for (
          const color of processedColors
        ) {
          totalR += color.r
          totalG += color.g
          totalB += color.b
        }

        const count =
          processedColors.length

        if (count > 0) {
          setRgb({
            r: Math.round(
              totalR / count,
            ),
            g: Math.round(
              totalG / count,
            ),
            b: Math.round(
              totalB / count,
            ),
          })
        }
      }
    }

    // ===================================================
    // WLED UPDATE
    // ===================================================

    if (
      wledConnectedRef.current &&
      now -
        lastWledUpdateRef.current >=
      WLED_INTERVAL
    ) {
      lastWledUpdateRef.current =
        now

      void sendZonesToWLED(
        processedColors,
      )
    }

    animationRef.current =
      requestAnimationFrame(
        calculateZones,
      )
  }

  // =====================================================
  // START CAPTURE
  // =====================================================

  const startCapture = async () => {
    if (!selectedScreen) {
      setError(
        'Please select a display first.',
      )

      return
    }

    if (zonesRef.current.length === 0) {
      setError(
        'Create at least one zone first.',
      )

      return
    }

    try {
      setError('')

      previousColorsRef.current = []

      lastFrameRef.current = 0
      lastWledUpdateRef.current = 0
      lastUiUpdateRef.current = 0

      const stream =
        await navigator.mediaDevices
          .getUserMedia({
            audio: false,
            video: {
              // Electron desktop capture.
              // @ts-expect-error Electron desktop capture
              mandatory: {
                chromeMediaSource:
                  'desktop',

                chromeMediaSourceId:
                  selectedScreen,
              },
            },
          })

      streamRef.current = stream

      const video =
        videoRef.current

      if (!video) {
        throw new Error(
          'Video element not found.',
        )
      }

      video.srcObject = stream

      await video.play()

      setCapturing(true)

      console.log(
        'CAPTURE STARTED',
      )

      animationRef.current =
        requestAnimationFrame(
          calculateZones,
        )
    } catch (err) {
      console.error(
        'CAPTURE ERROR:',
        err,
      )

      setCapturing(false)

      setError(
        'Unable to capture the selected display.',
      )
    }
  }

  // =====================================================
  // STOP CAPTURE
  // =====================================================

  function stopCapture() {
    if (
      animationRef.current !==
      null
    ) {
      cancelAnimationFrame(
        animationRef.current,
      )

      animationRef.current =
        null
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop()
        })

      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject =
        null
    }

    previousColorsRef.current = []

    lastFrameRef.current = 0
    lastWledUpdateRef.current = 0
    lastUiUpdateRef.current = 0

    setCapturing(false)

    setZoneColors([])

    setRgb({
      r: 0,
      g: 0,
      b: 0,
    })
  }

  // =====================================================
  // TEST WLED
  // =====================================================

  const testWLED = async () => {
    const ip =
      wledIp.trim()

    if (!ip) {
      setError(
        'Enter the WLED IP address.',
      )

      return
    }

    try {
      setError('')

      console.log(
        'Testing WLED:',
        ip,
      )

      const response =
        await fetch(
          `http://${ip}/json`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              on: true,

              bri: 150,

              seg: [
                {
                  id: 0,
                  start: 0,
                  stop: LED_COUNT,
                  col: [
                    [255, 0, 0],
                  ],
                },
              ],
            }),
          },
        )

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`,
        )
      }

      setWledConnected(true)
      wledConnectedRef.current =
        true

      console.log(
        'WLED CONNECTED',
      )
    } catch (err) {
      console.error(
        'WLED connection failed:',
        err,
      )

      setWledConnected(false)
      wledConnectedRef.current =
        false

      setError(
        'WLED connection failed. Check IP and network.',
      )
    }
  }

  // =====================================================
  // ZONE COLOR
  // =====================================================

  const zoneColor = (
    zoneId: number,
  ) => {
    const color =
      zoneColors.find(
        (item) =>
          item.zoneId === zoneId,
      )

    if (!color) {
      return 'rgb(20, 20, 20)'
    }

    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="app">
      {/* HEADER */}

      <header className="topbar">
        <div>
          <h1>AmbiSync</h1>

          <p>
            Screen reactive
            ambient lighting
          </p>
        </div>

        <span className="version">
          v0.7.0
        </span>
      </header>

      {/* ERROR */}

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {/* MAIN */}

      <section className="grid">
        {/* LIVE PREVIEW */}

        <div className="card preview-card">
          <div className="card-title">
            <span>
              Live Capture
            </span>

            <span className="status">
              <i
                className={
                  capturing
                    ? 'active'
                    : ''
                }
              />

              {capturing
                ? 'SYNCING'
                : 'READY'}
            </span>
          </div>

          <div className="screen-preview">
            <video
              ref={videoRef}
              muted
              playsInline
              className={
                capturing
                  ? 'live-video'
                  : 'hidden-video'
              }
            />

            {!capturing && (
              <div className="empty-screen">
                <span>
                  AMBISYNC
                </span>

                <small>
                  Select a display
                  and start sync
                </small>
              </div>
            )}
          </div>

          {/* RGB */}

          <div className="rgb-display">
            <div>
              <span>
                Average RGB
              </span>

              <strong>
                {rgb.r} · {rgb.g} · {rgb.b}
              </strong>
            </div>

            <div
              className="color-preview"
              style={{
                backgroundColor:
                  `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
              }}
            />
          </div>
        </div>

        {/* CONTROLS */}

        <aside className="card controls">
          <div className="card-title">
            AmbiSync Controls
          </div>

          {/* WLED */}

          <div className="setting">
            <div className="setting-header">
              <span>
                WLED
              </span>

              <strong>
                {wledConnected
                  ? 'CONNECTED'
                  : 'OFFLINE'}
              </strong>
            </div>

            <input
              type="text"
              value={wledIp}
              onChange={(event) =>
                setWledIp(
                  event.target.value,
                )
              }
              placeholder="192.168.1.105"
            />

            <button
              onClick={testWLED}
            >
              TEST WLED
            </button>

            {wledSending && (
              <small>
                Syncing...
              </small>
            )}
          </div>

          {/* DISPLAY */}

          <label>
            Monitor
          </label>

          <select
            value={selectedScreen}
            disabled={capturing}
            onChange={(event) =>
              setSelectedScreen(
                event.target.value,
              )
            }
          >
            <option value="">
              Select display
            </option>

            {sources.map(
              (source) => (
                <option
                  key={source.id}
                  value={source.id}
                >
                  {source.name}
                </option>
              ),
            )}
          </select>

          {/* START / STOP */}

          {!capturing ? (
            <button
              onClick={
                startCapture
              }
            >
              START SYNC
            </button>
          ) : (
            <button
              className="stop"
              onClick={
                stopCapture
              }
            >
              STOP SYNC
            </button>
          )}

          {/* BRIGHTNESS */}

          <div className="setting">
            <div className="setting-header">
              <span>
                Brightness
              </span>

              <strong>
                {Math.round(
                  brightness * 100,
                )}
                %
              </strong>
            </div>

            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={brightness}
              onChange={(event) =>
                setBrightness(
                  Number(
                    event.target.value,
                  ),
                )
              }
            />
          </div>

          {/* FPS */}

          <div className="setting">
            <div className="setting-header">
              <span>
                Processing FPS
              </span>

              <strong>
                {fps}
              </strong>
            </div>

            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={fps}
              onChange={(event) =>
                setFps(
                  Number(
                    event.target.value,
                  ),
                )
              }
            />
          </div>

          {/* SMOOTHNESS */}

          <div className="setting">
            <div className="setting-header">
              <span>
                Smoothing
              </span>

              <strong>
                {Math.round(
                  smoothness * 100,
                )}
                %
              </strong>
            </div>

            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={smoothness}
              onChange={(event) =>
                setSmoothness(
                  Number(
                    event.target.value,
                  ),
                )
              }
            />
          </div>

          {/* DEVICE INFO */}

          <div className="device">
            <span>
              Displays
            </span>

            <span>
              {sources.length}
            </span>
          </div>

          <div className="device">
            <span>
              LED Count
            </span>

            <span>
              {LED_COUNT}
            </span>
          </div>

          <div className="device">
            <span>
              Configured Zones
            </span>

            <span>
              {zones.length}
            </span>
          </div>

          <div className="device">
            <span>
              Screen Processing
            </span>

            <span>
              {fps} FPS
            </span>
          </div>

          <div className="device">
            <span>
              WLED Output
            </span>

            <span>
              {WLED_FPS} FPS
            </span>
          </div>
        </aside>
      </section>

      {/* ZONE EDITOR */}

      <section className="card">
        <div className="card-title">
          <span>Zone Editor</span>

          <button
            type="button"
            onClick={resetBottomLedLayout}
          >
            RESET TO BOTTOM 36 LEDs
          </button>
        </div>

        <ZoneEditor
          zones={zones}
          onZonesChange={
            handleZonesChange
          }
        />
      </section>

      {/* LIVE ZONE COLORS */}

      <section className="card zone-card">
        <div className="card-title">
          <span>
            LED Zone Output
          </span>

          <span>
            {zones.length}/{LED_COUNT}
          </span>
        </div>

        <div className="monitor-map">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="zone"
              style={{
                backgroundColor:
                  zoneColor(
                    zone.id,
                  ),
              }}
            >
              Z{zone.id + 1}
              <small>
                LED {zone.ledIndex}
              </small>
            </div>
          ))}
        </div>
      </section>

      {/* HIDDEN PROCESSING CANVAS */}

      <canvas
        ref={canvasRef}
        style={{
          display: 'none',
        }}
      />
    </main>
  )
}

export default App
