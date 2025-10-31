import Settings from '@overleaf/settings'

async function run({ assertHasStatusCode, loginCsrfToken, request }) {
  const response = await request('/login', {
    method: 'POST',
    json: {
      _csrf: loginCsrfToken,
      email: Settings.smokeTest.user,
      password: Settings.smokeTest.password,
    },
  })

  const body = response.body
  // login success and login failure both receive a status code of 200
  // see the frontend logic on how to handle the response:
  //   frontend/js/directives/asyncForm.js -> submitRequest
  if (body && body.message && body.message.type === 'error') {
    throw new Error(`login failed: ${body.message.text}`)
  }

  assertHasStatusCode(response, 200)
}

async function cleanup({ assertHasStatusCode, getCsrfTokenFor, request }) {
  const logoutCsrfToken = await getCsrfTokenFor('/project')
  const response = await request('/logout', {
    method: 'POST',
    headers: {
      'X-CSRF-Token': logoutCsrfToken,
    },
  })
  assertHasStatusCode(response, 302)
}

export default { cleanup, run }
