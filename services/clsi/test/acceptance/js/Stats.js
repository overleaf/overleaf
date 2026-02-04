import { fetchString } from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'
after(async function () {
  const metrics = await fetchString(`${Settings.apis.clsi.url}/metrics`)
  console.error('-- metrics --')
  console.error(metrics)
  console.error('-- metrics --')
})
