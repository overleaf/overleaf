const ProjectFlusher = require('../app/js/ProjectFlusher')

async function main() {
  console.log('Flushing all projects')
  return await new Promise((resolve, reject) => {
    const options = {
      limit: 100000,
      concurrency: 5,
    }
    ProjectFlusher.flushAllProjects(options, err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

main()
  .then(() => {
    console.log('Done flushing all projects')
    process.exit(0)
  })
  .catch(error => {
    console.error('There was an error flushing all projects', { error })
    process.exit(1)
  })
