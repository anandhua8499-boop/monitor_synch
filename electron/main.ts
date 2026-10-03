import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
} from 'electron'
import path from 'path'
import dgram from 'dgram'

let mainWindow: BrowserWindow | null = null

const udp = dgram.createSocket('udp4')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,

    webPreferences: {
      preload: path.join(
        __dirname,
        'preload.js',
      ),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

 if (process.env.VITE_DEV_SERVER_URL) {
  mainWindow.loadURL(
    process.env.VITE_DEV_SERVER_URL,
  )
} else {
  mainWindow.loadFile(
    path.join(
      __dirname,
      '../renderer',
      'index.html',
    ),
  )
}
}

app.whenReady().then(() => {
  // ================================
  // SCREEN SOURCES
  // ================================

  ipcMain.handle(
  'screen:getSources',
  async () => {
    try {
      const sources =
        await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: {
            width: 320,
            height: 180,
          },
          fetchWindowIcons: false,
        })

      console.log(
        'DISPLAY SOURCES:',
        sources.map((source) => ({
          id: source.id,
          name: source.name,
        })),
      )

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail:
          source.thumbnail.toDataURL(),
      }))
    } catch (error) {
      console.error(
        'SCREEN CAPTURE ERROR:',
        error,
      )

      throw error
    }
  },
)

  // ================================
  // WLED UDP
  // ================================

  ipcMain.handle(
    'wled:send',
    async (
      _event,
      {
        ip,
        colors,
      }: {
        ip: string
        colors: number[][]
      },
    ) => {
      try {
        const packet =
          createWledPacket(colors)

        await new Promise<void>(
          (resolve, reject) => {
            udp.send(
              packet,
              5568,
              ip,
              (error) => {
                if (error) {
                  reject(error)
                  return
                }

                resolve()
              },
            )
          },
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error(
          'WLED UDP error:',
          error,
        )

        return {
          success: false,
        }
      }
    },
  )

  // ================================
  // CREATE WINDOW
  // ================================

  createWindow()

  app.on('activate', () => {
    if (
      BrowserWindow.getAllWindows()
        .length === 0
    ) {
      createWindow()
    }
  })
})

// ================================
// APP CLOSE
// ================================

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ================================
// WLED PACKET
// ================================

function createWledPacket(
  colors: number[][],
): Buffer {
  const ledCount = Math.min(
    colors.length,
    36,
  )

  const packet = Buffer.alloc(
    4 + ledCount * 3,
  )

  // WARLS
  packet[0] = 2

  // Start LED
  packet[1] = 0

  // Number of LEDs - 1
  packet[2] = ledCount - 1

  // Reserved
  packet[3] = 0

  for (
    let i = 0;
    i < ledCount;
    i++
  ) {
    const [
      r = 0,
      g = 0,
      b = 0,
    ] = colors[i] || []

    packet[4 + i * 3] =
      clamp(r)

    packet[4 + i * 3 + 1] =
      clamp(g)

    packet[4 + i * 3 + 2] =
      clamp(b)
  }

  return packet
}

// ================================
// RGB CLAMP
// ================================

function clamp(
  value: number,
): number {
  return Math.max(
    0,
    Math.min(
      255,
      Math.round(value),
    ),
  )
}