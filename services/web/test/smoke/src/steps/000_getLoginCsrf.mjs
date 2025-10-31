async function run({ getCsrfTokenFor }) {
  const loginCsrfToken = await getCsrfTokenFor('/login')

  return { loginCsrfToken }
}

module.exports = { run }
