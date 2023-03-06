const TITLE_REGEX = /<title>Your Projects - .*, Online LaTeX Editor<\/title>/

async function run({ request, assertHasStatusCode }) {
  const response = await request('/project')

  assertHasStatusCode(response, 200)

  if (!TITLE_REGEX.test(response.body)) {
    throw new Error('body does not have correct title')
  }
}

module.exports = { run }
