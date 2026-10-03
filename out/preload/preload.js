"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld(
  "ambiSync",
  {
    getScreenSources: () => electron.ipcRenderer.invoke(
      "screen:getSources"
    ),
    sendColors: (ip, colors) => electron.ipcRenderer.invoke(
      "wled:send",
      {
        ip,
        colors
      }
    )
  }
);
