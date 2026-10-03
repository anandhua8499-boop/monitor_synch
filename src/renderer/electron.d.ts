export {}

declare global {
  interface Window {
    ambiSync: {
      getScreenSources: () => Promise<
        Array<{
          id: string
          name: string
          thumbnail: string
        }>
      >

      sendColors: (
        ip: string,
        colors: number[][],
      ) => Promise<{
        success: boolean
      }>
    }
  }
}