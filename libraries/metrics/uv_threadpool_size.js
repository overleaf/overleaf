if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = 16
  // eslint-disable-next-line no-console
  console.log(`Set UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE}`)
}
