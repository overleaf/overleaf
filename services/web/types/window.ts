declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    sl_debugging: boolean
    user: {
      id: string
    }
  }
}
export {} // pretend this is a module
