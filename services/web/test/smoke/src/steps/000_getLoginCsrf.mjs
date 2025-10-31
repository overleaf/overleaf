async function run({ getCsrfTokenFor }) {
  const loginCsrfToken = await getCsrfTokenFor('/login')

  return { loginCsrfToken }
}

export default { run }
