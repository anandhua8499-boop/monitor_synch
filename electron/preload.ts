import {
  contextBridge,
  ipcRenderer,
} from 'electron'

contextBridge.exposeInMainWorld(
  'ambiSync',
  {
    getScreenSources: () =>
      ipcRenderer.invoke(
        'screen:getSources',
      ),

    sendColors: (
      ip: string,
      colors: number[][],
    ) =>
      ipcRenderer.invoke(
        'wled:send',
        {
          ip,
          colors,
        },
      ),
  },
)