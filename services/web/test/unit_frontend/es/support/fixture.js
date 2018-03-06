class Fixture {
  constructor () {
    this.el = document.createElement('div')
  }

  load (html) {
    this.el.innerHTML = html
    return this.el.firstChild
  }

  cleanUp () {
    this.el.innerHTML = ''
  }
}

const fixture = new Fixture()
export default fixture
