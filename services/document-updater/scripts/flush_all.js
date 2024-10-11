const ProjectFlusher = require('../app/js/ProjectFlusher')
const minimist = require('minimist')

async function main() {
  const argv = minimist(process.argv.slice(2), {
    default: {
      limit: 100000,
      concurrency: 5,
      'dry-run': false,
    },
    boolean: ['dry-run', 'help'],
    alias: { h: 'help', n: 'dry-run', j: 'concurrency' },
  })

  if (argv.help) {
    console.log(`
Usage: node scripts/flush_all.js [options]

Options:
  --limit            Number of projects to flush (default: 100000)
  --concurrency, -j  Number of concurrent flush operations (default: 5)
  --dryRun, -n       Perform a dry run without making any changes (default: false)
  --help, -h         Show this help message
    `)
    process.exit(0)
  }

  const options = {
    limit: argv.limit,
    concurrency: argv.concurrency,
    dryRun: argv['dry-run'],
  }
  console.log('Flushing all projects with options:', options)

  return await new Promise((resolve, reject) => {
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
