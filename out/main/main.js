import { app, ipcMain, desktopCapturer, BrowserWindow } from "electron";
import path from "path";
import dgram from "dgram";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
let mainWindow = null;
const udp = dgram.createSocket("udp4");
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1e3,
    minHeight: 700,
    webPreferences: {
      preload: path.join(
        __dirname,
        "preload.js"
      ),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(
      process.env.VITE_DEV_SERVER_URL
    );
  } else {
    mainWindow.loadFile(
      path.join(
        __dirname,
        "../renderer",
        "index.html"
      )
    );
  }
}
app.whenReady().then(() => {
  ipcMain.handle(
    "screen:getSources",
    async () => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: {
            width: 320,
            height: 180
          },
          fetchWindowIcons: false
        });
        console.log(
          "DISPLAY SOURCES:",
          sources.map((source) => ({
            id: source.id,
            name: source.name
          }))
        );
        return sources.map((source) => ({
          id: source.id,
          name: source.name,
          thumbnail: source.thumbnail.toDataURL()
        }));
      } catch (error) {
        console.error(
          "SCREEN CAPTURE ERROR:",
          error
        );
        throw error;
      }
    }
  );
  ipcMain.handle(
    "wled:send",
    async (_event, {
      ip,
      colors
    }) => {
      try {
        const packet = createWledPacket(colors);
        await new Promise(
          (resolve, reject) => {
            udp.send(
              packet,
              5568,
              ip,
              (error) => {
                if (error) {
                  reject(error);
                  return;
                }
                resolve();
              }
            );
          }
        );
        return {
          success: true
        };
      } catch (error) {
        console.error(
          "WLED UDP error:",
          error
        );
        return {
          success: false
        };
      }
    }
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
function createWledPacket(colors) {
  const ledCount = Math.min(
    colors.length,
    36
  );
  const packet = Buffer.alloc(
    4 + ledCount * 3
  );
  packet[0] = 2;
  packet[1] = 0;
  packet[2] = ledCount - 1;
  packet[3] = 0;
  for (let i = 0; i < ledCount; i++) {
    const [
      r = 0,
      g = 0,
      b = 0
    ] = colors[i] || [];
    packet[4 + i * 3] = clamp(r);
    packet[4 + i * 3 + 1] = clamp(g);
    packet[4 + i * 3 + 2] = clamp(b);
  }
  return packet;
}
function clamp(value) {
  return Math.max(
    0,
    Math.min(
      255,
      Math.round(value)
    )
  );
}
