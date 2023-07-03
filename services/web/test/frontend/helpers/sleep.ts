export const sleep = (timeout: number) => {
  return new Promise(resolve => setTimeout(resolve, timeout))
}
