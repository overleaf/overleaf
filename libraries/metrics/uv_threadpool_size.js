if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = 16
  console.log(`Set UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE}`)
}
