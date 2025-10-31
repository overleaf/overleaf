const TITLE_REGEX =
  /<title[^>]*>Your projects - .*, Online LaTeX Editor<\/title>/

async function run({ request, assertHasStatusCode }) {
  const response = await request('/project')

  assertHasStatusCode(response, 200)

  if (!TITLE_REGEX.test(response.body)) {
    throw new Error('body does not have correct title')
  }
}

export default { run }
