/*
 * Creates the HTML for the institution in the institution table on /for/universities
 */

const name = process.argv[2]
const href = process.argv[3]
const image = process.argv[4]

function create() {
  if (!name) {
    return console.log('Error: Institution name is required')
  }
  const eventLabel = name.replace(/ /g, '-').replace(/\(|\)/g, '')
  if (!href) {
    return console.log('Error: Institution portal href is required')
  }
  let result = `  <div class="row">`
  result += `\n    <div class="col-sm-2 col-xs-3 text-center">`

  if (image) {
    result += `\n      <img alt="${name}" class="uni-logo" src="${image}">`
  }

  result += `\n    </div>`
  result += `\n    <div class="col-sm-8 col-xs-5">
        <p>
          <strong>${name}</strong>
        </p>`
  result += `\n    </div>`
  result += `\n    <div class="col-sm-2 col-xs-4 university-claim-btn">
        <a class="btn btn-primary" href="${href}" event-tracking-ga="For-Pages" event-tracking="Universities-Click-Edu" event-tracking-label="View-${eventLabel}" event-tracking-trigger="click">VIEW</a>
    </div>`
  result += '\n  </div>'

  console.log(result)
}

create()
