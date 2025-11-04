import _ from 'lodash'
import { ComponentType } from 'react'
import { Navbar } from 'react-bootstrap'
import OLPageContentCard from '@/shared/components/ol/ol-page-content-card'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import OLButton from '@/shared/components/ol/ol-button'
import CiamLayout from '@/shared/components/layouts/ciam-layout'

const lorem = (n: number) => {
  const quacks = ['quack', 'quack', 'quack', 'quak']
  let result = ''
  if (n >= 1) result += 'Lorem'
  if (n >= 2) result += ' epsom'
  for (let i = 2; i < n; i++) {
    const next =
      result.at(-1) === '.'
        ? ' ' + _.capitalize(quacks[Math.floor(Math.random() * quacks.length)])
        : quacks[Math.floor(Math.random() * (quacks.length + 1))]
    result += next ? ' ' + next : '.'
  }
  if (result.at(-1) !== '.') result += '.'
  return result
}

const Nav = () => <Navbar className="navbar-default navbar-main" />

export const UnsuportedBrowser = () => (
  <main className="content content-alt full-height" id="main-content">
    <div className="container full-height">
      <div className="error-container full-height">
        <div className="error-details">
          <h1 className="error-status">Unsupported Browser</h1>
          <p className="error-description">{lorem(60)}</p>
          <hr />
          <p>{lorem(40)}</p>
        </div>
      </div>
    </div>
  </main>
)

export const Error400 = () => (
  <main className="content content-alt full-height" id="main-content">
    <div className="container full-height">
      <div className="error-container full-height">
        <div className="error-details">
          <p className="error-status">Something went wrong, sorry.</p>
          <p className="error-description">{lorem(15)}</p>
        </div>
      </div>
    </div>
  </main>
)

export const Error404 = () => (
  <>
    <Nav />
    <main className="content content-alt" id="main-content">
      <div className="container">
        <div className="error-container">
          <div className="error-details">
            <p className="error-status">Not found</p>
            <p className="error-description">{lorem(20)}</p>
          </div>
        </div>
      </div>
    </main>
  </>
)

export const Closed = () => (
  <>
    <Nav />
    <main className="content" id="main-content">
      <div className="container">
        <div className="row">
          <div className="col-lg-8 col-lg-offset-2 text-center">
            <div className="page-header">
              <h1>Maintenance</h1>
            </div>
            <p>{lorem(6)}</p>
          </div>
        </div>
      </div>
    </main>
  </>
)

export const PlannedMaintenance = () => (
  <>
    <Nav />
    <main className="content" id="main-content">
      <div className="container">
        <div className="row">
          <div className="col-lg-8 col-lg-offset-2">
            <div className="page-header">
              <h1>Planned Maintenance</h1>
            </div>
            <p>{lorem(6)}</p>
          </div>
        </div>
      </div>
    </main>
  </>
)

export const PostGateway = () => (
  <>
    <div className="content content-alt">
      <div className="container">
        <div className="row">
          <div className="col-lg-6 offset-lg-3">
            <div className="card">
              <div className="card-body">
                <p className="text-center">
                  Please wait while we process your request.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
)

export const AccountSuspended = () => (
  <main className="content content-alt" id="main-content">
    <div className="container-custom-sm mx-auto">
      <div className="card">
        <div className="card-body">
          <h3>Your account is suspended</h3>
          <p>{lorem(6)}</p>
        </div>
      </div>
    </div>
  </main>
)

export const Restricted = () => (
  <>
    <Nav />
    <main className="content" id="main-content">
      <div className="container">
        <div className="row">
          <div className="col-md-8 offset-md-2 text-center">
            <div className="page-header">
              <h2>
                Restricted, sorry you don’t have permission to load this page.
              </h2>
            </div>
            <p>{lorem(23)}</p>
          </div>
        </div>
      </div>
    </main>
  </>
)

export const OneTimeLogin = () => (
  <>
    <Nav />
    <main className="content content-alt" id="main-content">
      <div className="container">
        <div className="row">
          <div className="col-lg-6 offset-lg-3 col-xl-4 offset-xl-4">
            <div className="card">
              <div className="card-body">
                <div className="page-header">
                  <h1>We're back!</h1>
                </div>
                <p>Overleaf is now running normally.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </>
)

export const Invite = () => (
  <main className="content content-alt" id="invite-root">
    <OLRow className="row row-spaced">
      <OLCol lg={{ span: 8, offset: 2 }}>
        <OLPageContentCard>
          <div className="page-header">
            <h1 className="text-center">
              <span className="team-invite-name">
                max.mustermann@example.com
              </span>{' '}
              has invited you to join a group subscription on Overleaf
            </h1>
          </div>
          <p className="text-center">{lorem(20)}</p>
        </OLPageContentCard>
      </OLCol>
    </OLRow>
  </main>
)

export const NotValid = () => (
  <>
    <Nav />
    <main className="content content-alt" id="main-content">
      <div className="container">
        <div className="row">
          <div className="col-md-8 col-md-offset-2 offset-md-2">
            <div className="card project-invite-invalid">
              <div className="card-body">
                <div className="page-header text-center">
                  <h1>Invite not valid</h1>
                </div>
                <div className="row text-center">
                  <div className="col-12 col-md-12">
                    <p>{lorem(20)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </>
)

export const CompleteRegistration = () => (
  <>
    <Nav />
    <main className="content content-alt" id="main-content">
      <div className="container">
        <div className="row">
          <div className="col-12 col-md-10 col-md-offset-1 col-lg-8 col-lg-offset-2 offset-md-1 offset-lg-2">
            <div className="card">
              <div className="card-body">
                <div className="page-header">
                  <h1 className="text-center">Dropbox Sync</h1>
                </div>
                <p>{lorem(20)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </>
)

export const Ciam = () => (
  <CiamLayout>
    <h1>Create your Overleaf account</h1>
    <p>{lorem(20)}</p>
    <hr />
    <p>{lorem(20)}</p>
    <OLButton>Button</OLButton>
  </CiamLayout>
)

export default {
  title: 'Shared / Layouts',
  args: {
    label: 'Option',
  },

  parameters: {
    layout: 'fullscreen', // This is crucial for vh/vw layouts
  },
  decorators: [
    (Story: ComponentType) => (
      <div style={{ height: '100vh', width: '100vw' }}>
        <style>
          {`.content {
                min-height: 100vh;
                padding-top: 93px;
           }`}
        </style>
        <Story />
      </div>
    ),
  ],
}
