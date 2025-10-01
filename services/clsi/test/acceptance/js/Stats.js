const { fetchString } = require('@overleaf/fetch-utils')
const Settings = require('@overleaf/settings')
after(async function () {
  const metrics = await fetchString(`${Settings.apis.clsi.url}/metrics`)
  console.error('-- metrics --')
  console.error(metrics)
  console.error('-- metrics --')
})
