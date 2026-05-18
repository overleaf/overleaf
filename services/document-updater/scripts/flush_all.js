const ProjectFlusher = require('../app/js/ProjectFlusher')
const minimist = require('minimist')

async function main() {
  const argv = minimist(process.argv.slice(2), {
    default: {
      limit: 100_000,
      concurrency: 5,
      'dry-run': false,
      'log-progress': 1_000,
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
  --dry-run, -n      Perform a dry run without making any changes (default: false)
  --log-progress     Log progress after flushing every Nth project (default: 1000)
  --help, -h         Show this help message
    `)
    process.exit(0)
  }

  const options = {
    limit: argv.limit,
    concurrency: argv.concurrency,
    dryRun: argv['dry-run'],
    logProgress: argv['log-progress'],
  }
  console.log('Flushing all projects with options:', options)

  await ProjectFlusher.promises.flushAllProjects(options)
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
