export async function processWithTimeout({ work, timeout, message }) {
  let workDeadLine
  function checkInResults() {
    clearTimeout(workDeadLine)
  }
  await Promise.race([
    new Promise((resolve, reject) => {
      workDeadLine = setTimeout(() => {
        reject(new Error(message))
      }, timeout)
    }),
    work.finally(checkInResults),
  ])
}
