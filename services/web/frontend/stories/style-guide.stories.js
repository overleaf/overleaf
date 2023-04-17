/* eslint-disable jsx-a11y/anchor-is-valid */

import { Grid, Row, Col, Button, Alert, ProgressBar } from 'react-bootstrap'

export const Colors = () => {
  return (
    <div className="content content-alt">
      <Grid>
        <Row>
          <Col md={8} mdOffset={2}>
            <h2>Colours</h2>
            <div className="color-row">
              <div className="color-box ol-blue-gray-1">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-blue-gray-2">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-blue-gray-3">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-blue-gray-4">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-blue-gray-5">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-blue-gray-6">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
            </div>
            <div className="color-row">
              <div className="color-box ol-green">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-dark-green">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-blue">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-dark-blue">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-red">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
              <div className="color-box ol-dark-red">
                <div className="color-swatch" />
                <div className="color-label">
                  <pre className="color-less-var" />
                  <pre className="color-hex-val" />
                  <pre className="color-rgb-val" />
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Grid>
    </div>
  )
}

export const Headings = () => {
  return (
    <div className="content content-alt">
      <Grid>
        <Row>
          <Col md={8} mdOffset={2}>
            <h2>Headings</h2>
            <p>Here are our heading styles:</p>
            <h1>Heading level 1</h1>
            <p>
              Lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem
              ipsum
            </p>
            <h2>Heading level 2</h2>
            <p>
              Lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem
              ipsum lorem ipsum
            </p>
            <h3>Heading level 3</h3>
            <p>
              Lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem
              ipsum lorem ipsum
            </p>
            <h4>Heading level 4</h4>
            <p>
              Lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem ipsum lorem
              ipsum lorem ipsum
            </p>
          </Col>
        </Row>
      </Grid>
    </div>
  )
}

const ButtonsTemplate = (args, { globals: { theme } }) => {
  return (
    <div className="content content-alt">
      <fieldset disabled={args.disabled}>
        <Grid>
          <Row>
            <Col md={8} mdOffset={2}>
              <h2>Buttons</h2>

              <h3>Primary Button</h3>
              <p>
                <Button bsStyle="primary">Primary Button</Button>
              </p>

              <h3>Secondary Button</h3>
              {theme.includes('main') ? (
                <>
                  <p>
                    <button className="btn btn-secondary">
                      Secondary Button
                    </button>
                  </p>
                  <h3>Deprecated Styles</h3>
                  <p>
                    These are being transitioned to the new secondary style
                    above
                  </p>
                </>
              ) : (
                ''
              )}
              <p>Our secondary button is blue or dark gray:</p>
              <div className="btn-toolbar">
                <Button bsStyle="info">Info Button</Button>
                <Button bsStyle="default">Default Button</Button>
              </div>

              <h3>All button styles</h3>
              {theme.includes('main') ? (
                <p>Includes styles being deprecated</p>
              ) : (
                ''
              )}
              <div className="btn-toolbar">
                <Button bsStyle="primary">Primary</Button>
                {theme.includes('main') ? (
                  <button className="btn btn-secondary">Secondary</button>
                ) : (
                  ''
                )}
                <Button bsStyle="info">Info</Button>
                <Button bsStyle="default">Default</Button>
                <Button bsStyle="primary">Success</Button>
                <Button bsStyle="warning">Warning</Button>
                <Button bsStyle="danger">Danger</Button>
                <Button className="btn-danger-ghost" bsStyle={null}>
                  Danger Ghost
                </Button>
              </div>

              <h3>Sizes</h3>
              <div className="btn-toolbar">
                <button className="btn btn-primary btn-xs">Extra Small</button>
                <button className="btn btn-primary btn-sm">Small</button>
                <button className="btn btn-primary">Default</button>
                <button className="btn btn-primary btn-lg">Large</button>
                <button className="btn btn-primary btn-xl">Extra Large</button>
              </div>

              <h2>Hyperlinks</h2>
              <p>
                Hyperlinks are highlighted <a href="#">as shown</a>.
              </p>
            </Col>
          </Row>
        </Grid>
      </fieldset>
    </div>
  )
}

export const Buttons = ButtonsTemplate.bind({})
Buttons.args = {
  disabled: false,
}

export const Alerts = () => {
  return (
    <div className="content content-alt">
      <Grid>
        <Row>
          <Col md={8} mdOffset={2}>
            <h2>Alerts</h2>

            <Alert bsStyle="danger">
              An <code>.alert-danger</code> alert
            </Alert>
            <Alert bsStyle="success">
              An <code>.alert-success</code> alert
            </Alert>
            <Alert bsStyle="info">
              An <code>.alert-info</code> alert
            </Alert>
            <Alert bsStyle="warning">
              An <code>.alert-warning</code> alert
            </Alert>
          </Col>
        </Row>
      </Grid>
    </div>
  )
}

export const ProgressBars = () => {
  return (
    <div className="content content-alt">
      <Grid>
        {' '}
        <Row>
          <Col md={8} mdOffset={2}>
            <h2>Progress bars</h2>
            <ProgressBar bsStyle="danger" now={20} />
            <ProgressBar bsStyle="success" now={40} />
            <ProgressBar bsStyle="info" now={60} />
            <ProgressBar bsStyle="warning" now={80} />
          </Col>
        </Row>
      </Grid>
    </div>
  )
}

export const Cards = () => {
  return (
    <div className="content content-alt">
      <Grid>
        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <p>
                Cards look best on a <code>.content.content-alt</code>{' '}
                background
              </p>
            </div>
          </Col>
        </Row>
      </Grid>
    </div>
  )
}

export const Forms = () => {
  return (
    <div className="content content-alt">
      <Grid>
        <Row className="row-spaced">
          <Col md={8} mdOffset={2}>
            <div className="card">
              <h2>Form elements—basic example</h2>
              <form className="ng-pristine ng-valid">
                <div className="form-group">
                  <label htmlFor="exampleInputEmail1">Email address</label>
                  <input
                    className="form-control"
                    id="exampleInputEmail1"
                    type="email"
                    placeholder="Email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="exampleInputPassword1">Password</label>
                  <input
                    className="form-control"
                    id="exampleInputPassword1"
                    type="password"
                    placeholder="Password"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="exampleInputFile">File input</label>
                  <input id="exampleInputFile" type="file" />
                  <p className="help-block">
                    Example block-level help text here.
                  </p>
                </div>
                <div className="checkbox">
                  <label>
                    <input type="checkbox" /> Check me out
                  </label>
                  <button className="btn btn-default" type="submit">
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </Col>
        </Row>

        <Row className="row-spaced">
          <Col md={8} mdOffset={2}>
            <div className="card">
              <h2>Inline form</h2>
              <form className="form-inline ng-pristine ng-valid">
                <div className="form-group">
                  <label htmlFor="exampleInputName2">Name</label>
                  <input
                    className="form-control"
                    id="exampleInputName2"
                    type="text"
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="exampleInputEmail2">Email</label>
                  <input
                    className="form-control"
                    id="exampleInputEmail2"
                    type="email"
                    placeholder="jane.doe@example.com"
                  />
                </div>
                <button className="btn btn-default" type="submit">
                  Send invitation
                </button>
              </form>
            </div>
          </Col>
        </Row>

        <Row className="row-spaced">
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="form-inline ng-pristine ng-valid">
                <div className="form-group">
                  <label className="sr-only" htmlFor="exampleInputEmail3">
                    Email address
                  </label>
                  <input
                    className="form-control"
                    id="exampleInputEmail3"
                    type="email"
                    placeholder="Email"
                  />
                </div>
                <div className="form-group">
                  <label className="sr-only" htmlFor="exampleInputPassword3">
                    Password
                  </label>
                  <input
                    className="form-control"
                    id="exampleInputPassword3"
                    type="password"
                    placeholder="Password"
                  />
                </div>
                <div className="checkbox">
                  <label>
                    <input type="checkbox" /> Remember me
                  </label>
                </div>
                <button className="btn btn-default" type="submit">
                  Sign in
                </button>
              </form>
            </div>
          </Col>
        </Row>

        <Row className="row-spaced">
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="form-inline ng-pristine ng-valid">
                <div className="form-group">
                  <label className="sr-only" htmlFor="exampleInputAmount">
                    Amount (in dollars)
                  </label>
                  <div className="input-group">
                    <div className="input-group-addon">$</div>
                    <input
                      className="form-control"
                      id="exampleInputAmount"
                      type="text"
                      placeholder="Amount"
                    />
                    <div className="input-group-addon">.00</div>
                  </div>
                </div>
                <button className="btn btn-primary" type="submit">
                  Transfer cash
                </button>
              </form>
            </div>
          </Col>
        </Row>

        <Row className="row-spaced">
          <Col md={8} mdOffset={2}>
            <div className="card">
              <h2>Horizontal form</h2>
              <form className="form-horizontal ng-pristine ng-valid">
                <div className="form-group">
                  <label
                    className="col-sm-2 control-label"
                    htmlFor="inputEmail3"
                  >
                    Email
                  </label>
                  <div className="col-sm-10">
                    <input
                      className="form-control"
                      id="inputEmail3"
                      type="email"
                      placeholder="Email"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label
                    className="col-sm-2 control-label"
                    htmlFor="inputPassword3"
                  >
                    Password
                  </label>
                  <div className="col-sm-10">
                    <input
                      className="form-control"
                      id="inputPassword3"
                      type="password"
                      placeholder="Password"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <div className="col-sm-offset-2 col-sm-10">
                    <div className="checkbox">
                      <label>
                        <input type="checkbox" /> Remember me
                      </label>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <div className="col-sm-offset-2 col-sm-10">
                    <button className="btn btn-default" type="submit">
                      Sign in
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </Col>
        </Row>

        <Row className="row-spaced">
          <Col md={8} mdOffset={2}>
            <div className="card">
              <h2>Supported controls</h2>
              <form className="ng-pristine ng-valid">
                <input
                  className="form-control"
                  type="text"
                  placeholder="Text input"
                />
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Textarea"
                />
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <div className="checkbox">
                  <label>
                    <input type="checkbox" defaultValue="" />
                    Option one is this and that—be sure to include why it's
                    great
                  </label>
                </div>
                <div className="checkbox disabled">
                  <label>
                    <input type="checkbox" defaultValue="" disabled="" />
                    Option two is disabled
                  </label>
                </div>
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <div className="radio">
                  <label>
                    <input
                      id="optionsRadios1"
                      type="radio"
                      name="optionsRadios"
                      defaultValue="option1"
                      defaultChecked="checked"
                    />
                    Option one is this and that—be sure to include why it's
                    great
                  </label>
                </div>
                <div className="radio">
                  <label>
                    <input
                      id="optionsRadios2"
                      type="radio"
                      name="optionsRadios"
                      defaultValue="option2"
                    />
                    Option two can be something else and selecting it will
                    deselect option one
                  </label>
                </div>
                <div className="radio disabled">
                  <label>
                    <input
                      id="optionsRadios3"
                      type="radio"
                      name="optionsRadios"
                      defaultValue="option3"
                      disabled=""
                    />
                    Option three is disabled
                  </label>
                </div>
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <label className="checkbox-inline">
                  <input id="inlineCheckbox1" type="checkbox" value="option1" />
                  1
                </label>
                <label className="checkbox-inline">
                  <input id="inlineCheckbox2" type="checkbox" value="option2" />
                  2
                </label>
                <label className="checkbox-inline">
                  <input id="inlineCheckbox3" type="checkbox" value="option3" />
                  3
                </label>
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <label className="radio-inline">
                  <input
                    id="inlineRadio1"
                    type="radio"
                    name="inlineRadioOptions"
                    defaultValue="option1"
                  />
                  1
                </label>
                <label className="radio-inline">
                  <input
                    id="inlineRadio2"
                    type="radio"
                    name="inlineRadioOptions"
                    defaultValue="option2"
                  />
                  2
                </label>
                <label className="radio-inline">
                  <input
                    id="inlineRadio3"
                    type="radio"
                    name="inlineRadioOptions"
                    defaultValue="option3"
                  />
                  3
                </label>
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <select className="form-control">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <select className="form-control" multiple="">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </form>
            </div>
          </Col>
        </Row>

        <Row className="row-spaced">
          <Col md={8} mdOffset={2}>
            <div className="card">
              <h2>Form states</h2>
              <form className="form-inline ng-pristine ng-valid">
                <div className="form-group">
                  {/* eslint-disable-next-line */}
                  <label className="sr-only">Emails</label>
                  <p className="form-control-static">email@example.com</p>
                </div>
                <div className="form-group">
                  <label className="sr-only" htmlFor="inputPassword2">
                    Password
                  </label>
                  <input
                    className="form-control"
                    id="inputPassword2"
                    type="password"
                    placeholder="Password"
                  />
                </div>
                <button className="btn btn-default" type="submit">
                  Confirm identity
                </button>
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <input
                  className="form-control"
                  id="focusedInput"
                  type="text"
                  defaultValue="Demonstrative focus state"
                />
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <input
                  className="form-control"
                  id="disabledInput"
                  type="text"
                  placeholder="Disabled input here…"
                  disabled=""
                />
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <input
                  className="form-control"
                  type="text"
                  placeholder="Readonly input here…"
                  readOnly=""
                />
              </form>
            </div>
          </Col>
        </Row>

        <Row>
          <Col md={8} mdOffset={2}>
            <div className="card">
              <form className="ng-pristine ng-valid">
                <div className="form-group">
                  <label htmlFor="inputHelpBlock">Input with help text</label>
                  <input
                    className="form-control"
                    id="inputHelpBlock"
                    type="text"
                    aria-describedby="helpBlock"
                  />
                </div>
                <span className="help-block" id="helpBlock">
                  A block of help text that breaks onto a new line and may
                  extend beyond one line.
                </span>
              </form>
            </div>
          </Col>
        </Row>

        <Row className="row-spaced">
          <Col md={8} mdOffset={2}>
            <div className="card">
              <h2>Validation states</h2>
              <form className="ng-pristine ng-valid">
                <div className="form-group has-success">
                  <label className="control-label" htmlFor="inputSuccess1">
                    Input with success
                  </label>
                  <input
                    className="form-control"
                    id="inputSuccess1"
                    type="text"
                    aria-describedby="helpBlock2"
                  />
                  <span className="help-block" id="helpBlock2">
                    A block of help text that breaks onto a new line and may
                    extend beyond one line.
                  </span>
                </div>
                <div className="form-group has-warning">
                  <label className="control-label" htmlFor="inputWarning1">
                    Input with warning
                  </label>
                  <input
                    className="form-control"
                    id="inputWarning1"
                    type="text"
                  />
                </div>
                <div className="form-group has-error">
                  <label className="control-label" htmlFor="inputError1">
                    Input with error
                  </label>
                  <input
                    className="form-control"
                    id="inputError1"
                    type="text"
                  />
                </div>
                <div className="has-success">
                  <div className="checkbox">
                    <label>
                      <input
                        id="checkboxSuccess"
                        type="checkbox"
                        defaultValue="option1"
                      />
                      Checkbox with success
                    </label>
                  </div>
                </div>
                <div className="has-warning">
                  <div className="checkbox">
                    <label>
                      <input
                        id="checkboxWarning"
                        type="checkbox"
                        defaultValue="option1"
                      />
                      Checkbox with warning
                    </label>
                  </div>
                </div>
                <div className="has-error">
                  <div className="checkbox">
                    <label>
                      <input
                        id="checkboxError"
                        type="checkbox"
                        defaultValue="option1"
                      />
                      Checkbox with error
                    </label>
                  </div>
                </div>
              </form>
            </div>
          </Col>
        </Row>
      </Grid>
    </div>
  )
}

export default {
  title: 'Style Guide',
}
