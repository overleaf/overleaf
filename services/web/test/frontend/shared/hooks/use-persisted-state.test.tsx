import sinon from 'sinon'
import { expect } from 'chai'
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import usePersistedState from '../../../../frontend/js/shared/hooks/use-persisted-state'
import localStorage from '@/infrastructure/local-storage'

describe('usePersistedState', function () {
  beforeEach(function () {
    sinon.spy(window.Storage.prototype, 'getItem')
    sinon.spy(window.Storage.prototype, 'removeItem')
    sinon.spy(window.Storage.prototype, 'setItem')
  })

  afterEach(function () {
    sinon.restore()
  })

  it('reads the value from localStorage', function () {
    const key = 'test'
    localStorage.setItem(key, 'foo')
    expect(window.Storage.prototype.setItem).to.have.callCount(1)

    const Test = () => {
      const [value] = usePersistedState<string>(key)

      return <div>{value}</div>
    }

    render(<Test />)
    screen.getByText('foo')

    expect(window.Storage.prototype.getItem).to.have.callCount(1)
    expect(window.Storage.prototype.removeItem).to.have.callCount(0)
    expect(window.Storage.prototype.setItem).to.have.callCount(1)

    expect(localStorage.getItem(key)).to.equal('foo')
  })

  it('uses the default value without storing anything', function () {
    const key = 'test:default'

    const Test = () => {
      const [value] = usePersistedState(key, 'foo')

      return <div>{value}</div>
    }

    render(<Test />)
    screen.getByText('foo')

    expect(window.Storage.prototype.getItem).to.have.callCount(1)
    expect(window.Storage.prototype.removeItem).to.have.callCount(0)
    expect(window.Storage.prototype.setItem).to.have.callCount(0)

    expect(localStorage.getItem(key)).to.be.null
  })

  it('stores the new value in localStorage', function () {
    const key = 'test:store'
    localStorage.setItem(key, 'foo')
    expect(window.Storage.prototype.setItem).to.have.callCount(1)

    const Test = () => {
      const [value, setValue] = usePersistedState(key, 'bar')

      useEffect(() => {
        setValue('baz')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('baz')

    expect(window.Storage.prototype.getItem).to.have.callCount(1)
    expect(window.Storage.prototype.removeItem).to.have.callCount(0)
    expect(window.Storage.prototype.setItem).to.have.callCount(2)

    expect(localStorage.getItem(key)).to.equal('baz')
  })

  it('removes the value from localStorage if it equals the default value', function () {
    const key = 'test:store-default'
    localStorage.setItem(key, 'foo')
    expect(window.Storage.prototype.setItem).to.have.callCount(1)

    const Test = () => {
      const [value, setValue] = usePersistedState(key, 'bar')

      useEffect(() => {
        // set a different value
        setValue('baz')
        expect(localStorage.getItem(key)).to.equal('baz')

        // set the default value again
        setValue('bar')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('bar')

    expect(window.Storage.prototype.getItem).to.have.callCount(2)
    expect(window.Storage.prototype.removeItem).to.have.callCount(1)
    expect(window.Storage.prototype.setItem).to.have.callCount(2)

    expect(localStorage.getItem(key)).to.be.null
  })

  it('handles function values', function () {
    const key = 'test:store'
    localStorage.setItem(key, 'foo')
    expect(window.Storage.prototype.setItem).to.have.callCount(1)

    const Test = () => {
      const [value, setValue] = usePersistedState<string>(key)

      useEffect(() => {
        setValue(value => value + 'bar')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('foobar')

    expect(window.Storage.prototype.getItem).to.have.callCount(1)
    expect(window.Storage.prototype.removeItem).to.have.callCount(0)
    expect(window.Storage.prototype.setItem).to.have.callCount(2)

    expect(localStorage.getItem(key)).to.equal('foobar')
  })

  it('converts persisted value (string to boolean)', function () {
    const key = 'test:convert'
    localStorage.setItem(key, 'yep')

    const Test = () => {
      const [value, setValue] = usePersistedState(key, true, {
        converter: {
          toPersisted(value) {
            return value ? 'yep' : 'nope'
          },
          fromPersisted(persistedValue) {
            return persistedValue === 'yep'
          },
        },
      })

      useEffect(() => {
        setValue(false)
      }, [setValue])

      return <div>{String(value)}</div>
    }

    render(<Test />)

    screen.getByText('false')
    expect(localStorage.getItem(key)).to.equal('nope')
  })

  it('handles syncing values via storage event', async function () {
    const key = 'test:sync'
    localStorage.setItem(key, 'foo')
    expect(window.Storage.prototype.setItem).to.have.callCount(1)

    // listen for storage events
    const storageEventListener = sinon.stub()
    window.addEventListener('storage', storageEventListener)

    const Test = () => {
      const [value, setValue] = usePersistedState(key, 'bar', { listen: true })

      useEffect(() => {
        setValue('baz')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('baz')

    expect(window.Storage.prototype.getItem).to.have.callCount(1)
    expect(window.Storage.prototype.removeItem).to.have.callCount(0)
    expect(window.Storage.prototype.setItem).to.have.callCount(2)

    expect(localStorage.getItem(key)).to.equal('baz')

    expect(storageEventListener).to.have.callCount(0)

    // set the new value in localStorage
    localStorage.setItem(key, 'cat')

    // dispatch a "storage" event and check that it's picked up by the hook
    window.dispatchEvent(new StorageEvent('storage', { key }))

    await screen.findByText('cat')

    expect(storageEventListener).to.have.callCount(1)
  })
})
