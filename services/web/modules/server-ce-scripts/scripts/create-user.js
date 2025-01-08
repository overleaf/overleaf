/**
 * WARNING
 * This file has been replaced by create-user.mjs. It is left in place for backwards compatibility with previous versions of Overleaf.
 * This will be used by the e2e tests that check the upgrade from the older versions, if these tests are updated or removed,
 * this file can be removed as well.
 */

async function main() {
  const { default: createUser } = await import('./create-user.mjs')
  await createUser()
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
