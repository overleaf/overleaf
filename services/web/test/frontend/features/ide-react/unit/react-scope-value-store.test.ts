import { expect } from 'chai'
import { ReactScopeValueStore } from '@/features/ide-react/scope-value-store/react-scope-value-store'
import sinon from 'sinon'
import customLocalStorage from '@/infrastructure/local-storage'

function waitForWatchers(callback: () => void) {
  return new Promise(resolve => {
    callback()
    window.setTimeout(resolve, 1)
  })
}

describe('ReactScopeValueStore', function () {
  it('can set and retrieve a value', function () {
    const store = new ReactScopeValueStore()
    store.set('test', 'wombat')
    const retrieved = store.get('test')
    expect(retrieved).to.equal('wombat')
  })

  it('can overwrite a value', function () {
    const store = new ReactScopeValueStore()
    store.set('test', 'wombat')
    store.set('test', 'not a wombat')
    const retrieved = store.get('test')
    expect(retrieved).to.equal('not a wombat')
  })

  it('can overwrite a nested value', function () {
    const store = new ReactScopeValueStore()
    store.set('test', { prop: 'wombat' })
    store.set('test.prop', 'not a wombat')
    const retrieved = store.get('test.prop')
    expect(retrieved).to.equal('not a wombat')
  })

  it('throws an error when retrieving an unknown value', function () {
    const store = new ReactScopeValueStore()
    expect(() => store.get('test')).to.throw
  })

  it('can watch a value', async function () {
    const store = new ReactScopeValueStore()
    store.set('changing', 'one')
    store.set('fixed', 'one')
    const changingItemWatcher = sinon.stub()
    const fixedItemWatcher = sinon.stub()
    await waitForWatchers(() => {
      store.watch('changing', changingItemWatcher)
      store.watch('fixed', fixedItemWatcher)
    })
    expect(changingItemWatcher).to.have.been.calledWith('one')
    expect(fixedItemWatcher).to.have.been.calledWith('one')
    changingItemWatcher.reset()
    fixedItemWatcher.reset()
    await waitForWatchers(() => {
      store.set('changing', 'two')
    })
    expect(changingItemWatcher).to.have.been.calledWith('two')
    expect(fixedItemWatcher).not.to.have.been.called
  })

  it('allows synchronous watcher updates', function () {
    const store = new ReactScopeValueStore()
    store.set('test', 'wombat')
    const watcher = sinon.stub()
    store.watch('test', watcher)
    store.set('test', 'not a wombat')
    expect(watcher).not.to.have.been.called
    store.flushUpdates()
    expect(watcher).to.have.been.calledWith('not a wombat')
  })

  it('removes a watcher', async function () {
    const store = new ReactScopeValueStore()
    store.set('test', 'wombat')
    const watcher = sinon.stub()
    const removeWatcher = store.watch('test', watcher)
    store.flushUpdates()
    watcher.reset()
    removeWatcher()
    store.set('test', 'not a wombat')
    store.flushUpdates()
    expect(watcher).not.to.have.been.called
  })

  it('does not call a watcher removed between observing change and being called', async function () {
    const store = new ReactScopeValueStore()
    store.set('test', 'wombat')
    const watcher = sinon.stub()
    const removeWatcher = store.watch('test', watcher)
    store.flushUpdates()
    watcher.reset()
    store.set('test', 'not a wombat')
    removeWatcher()
    store.flushUpdates()
    expect(watcher).not.to.have.been.called
  })

  it('does not trigger watcher on setting to an identical value', async function () {
    const store = new ReactScopeValueStore()
    store.set('test', 'wombat')
    const watcher = sinon.stub()
    await waitForWatchers(() => {
      store.watch('test', watcher)
    })
    expect(watcher).to.have.been.calledWith('wombat')
    watcher.reset()
    await waitForWatchers(() => {
      store.set('test', 'wombat')
    })
    expect(watcher).not.to.have.been.called
  })

  it('can watch a value before it has been set', async function () {
    const store = new ReactScopeValueStore()
    const watcher = sinon.stub()
    store.watch('test', watcher)
    await waitForWatchers(() => {
      store.set('test', 'wombat')
    })
    expect(watcher).to.have.been.calledWith('wombat')
  })

  it('handles multiple watchers for the same path added at the same time before the value is set', async function () {
    const store = new ReactScopeValueStore()

    const watcherOne = sinon.stub()
    const watcherTwo = sinon.stub()
    store.watch('test', watcherOne)
    store.watch('test', watcherTwo)
    await waitForWatchers(() => {
      store.set('test', 'wombat')
    })

    expect(watcherOne).to.have.been.calledWith('wombat')
    expect(watcherTwo).to.have.been.calledWith('wombat')
  })

  it('handles multiple watchers for the same path added at the same time after the value is set', async function () {
    const store = new ReactScopeValueStore()
    store.set('test', 'wombat')

    const watcherOne = sinon.stub()
    const watcherTwo = sinon.stub()
    store.watch('test', watcherOne)
    store.watch('test', watcherTwo)
    store.flushUpdates()

    expect(watcherOne).to.have.been.calledWith('wombat')
    expect(watcherTwo).to.have.been.calledWith('wombat')
  })

  it('throws an error when watching an unknown value', function () {
    const store = new ReactScopeValueStore()
    expect(() => store.watch('test', () => {})).to.throw
  })

  it('sets nested value if watched', function () {
    const store = new ReactScopeValueStore()
    store.set('test', { nested: 'one' })
    const watcher = sinon.stub()
    store.watch('test.nested', watcher)
    const retrieved = store.get('test.nested')
    expect(retrieved).to.equal('one')
  })

  it('does not set nested value if not watched', function () {
    const store = new ReactScopeValueStore()
    store.set('test', { nested: 'one' })
    expect(() => store.get('test.nested')).to.throw
  })

  it('can watch a nested value', async function () {
    const store = new ReactScopeValueStore()
    store.set('test', { nested: 'one' })
    const watcher = sinon.stub()
    store.watch('test.nested', watcher)
    await waitForWatchers(() => {
      store.set('test', { nested: 'two' })
    })
    expect(watcher).to.have.been.calledWith('two')
  })

  it('can watch a deeply nested value', async function () {
    const store = new ReactScopeValueStore()
    store.set('test', { levelOne: { levelTwo: { levelThree: 'one' } } })
    const watcher = sinon.stub()
    store.watch('test.levelOne.levelTwo.levelThree', watcher)
    await waitForWatchers(() => {
      store.set('test', { levelOne: { levelTwo: { levelThree: 'two' } } })
    })
    expect(watcher).to.have.been.calledWith('two')
  })

  it('does not inform nested value watcher when nested value does not change', async function () {
    const store = new ReactScopeValueStore()
    store.set('test', { nestedOne: 'one', nestedTwo: 'one' })
    const nestedOneWatcher = sinon.stub()
    const nestedTwoWatcher = sinon.stub()
    await waitForWatchers(() => {
      store.watch('test.nestedOne', nestedOneWatcher)
      store.watch('test.nestedTwo', nestedTwoWatcher)
    })
    nestedOneWatcher.reset()
    nestedTwoWatcher.reset()
    await waitForWatchers(() => {
      store.set('test', { nestedOne: 'two', nestedTwo: 'one' })
    })
    expect(nestedOneWatcher).to.have.been.calledWith('two')
    expect(nestedTwoWatcher).not.to.have.been.called
  })

  it('deletes nested values that no longer exist', function () {
    const store = new ReactScopeValueStore()
    store.set('test', { levelOne: { levelTwo: { levelThree: 'one' } } })
    store.set('test', { levelOne: { different: 'wombat' } })
    const retrieved = store.get('test.levelOne.different')
    expect(retrieved).to.equal('wombat')
    expect(() => store.get('test.levelOne.levelTwo')).to.throw
    expect(() => store.get('test.levelOne.levelTwo.levelThree')).to.throw
  })

  it('does not throw for allowed non-existent path', function () {
    const store = new ReactScopeValueStore()
    store.allowNonExistentPath('wombat')
    store.set('test', { levelOne: { levelTwo: { levelThree: 'one' } } })
    store.set('test', { levelOne: { different: 'wombat' } })
    expect(() => store.get('test')).not.to.throw
    expect(store.get('wombat')).to.equal(undefined)
  })

  it('does not throw for deep allowed non-existent path', function () {
    const store = new ReactScopeValueStore()
    store.allowNonExistentPath('wombat', true)
    expect(() => store.get('wombat')).not.to.throw
    expect(() => store.get('wombat.nested')).not.to.throw
    expect(() => store.get('wombat.really.very.nested')).not.to.throw
  })

  it('throws for nested value in non-deep allowed non-existent path', function () {
    const store = new ReactScopeValueStore()
    store.allowNonExistentPath('wombat', false)
    expect(() => store.get('wombat.nested')).to.throw
  })

  it('throws for ancestor of allowed non-existent path', function () {
    const store = new ReactScopeValueStore()
    store.allowNonExistentPath('wombat.nested', true)
    expect(() => store.get('wombat.really.very.nested')).not.to.throw
    expect(() => store.get('wombat')).to.throw
  })

  it('updates ancestors', async function () {
    const store = new ReactScopeValueStore()
    const testValue = {
      prop1: {
        subProp: 'wombat',
      },
      prop2: {
        subProp: 'wombat',
      },
    }
    store.set('test', testValue)
    const rootWatcher = sinon.stub()
    const prop1Watcher = sinon.stub()
    const subPropWatcher = sinon.stub()
    const prop2Watcher = sinon.stub()
    await waitForWatchers(() => {
      store.watch('test', rootWatcher)
      store.watch('test.prop1', prop1Watcher)
      store.watch('test.prop1.subProp', subPropWatcher)
      store.watch('test.prop2', prop2Watcher)
    })
    rootWatcher.reset()
    prop1Watcher.reset()
    subPropWatcher.reset()
    prop2Watcher.reset()
    await waitForWatchers(() => {
      store.set('test.prop1.subProp', 'picard')
    })
    expect(store.get('test')).to.deep.equal({
      prop1: {
        subProp: 'picard',
      },
      prop2: {
        subProp: 'wombat',
      },
    })
    expect(store.get('test.prop2')).to.equal(testValue.prop2)
    expect(rootWatcher).to.have.been.called
    expect(prop1Watcher).to.have.been.called
    expect(subPropWatcher).to.have.been.called
    expect(prop2Watcher).not.to.have.been.called
  })

  describe('persistence', function () {
    beforeEach(function () {
      customLocalStorage.clear()
    })

    it('persists string to local storage', function () {
      const store = new ReactScopeValueStore()
      store.persisted('test-path', 'fallback value', 'test-storage-key')
      expect(store.get('test-path')).to.equal('fallback value')
      store.set('test-path', 'new value')
      expect(customLocalStorage.getItem('test-storage-key')).to.equal(
        'new value'
      )
    })

    it("doesn't persist string to local storage until set() is called", function () {
      const store = new ReactScopeValueStore()
      store.persisted('test-path', 'fallback value', 'test-storage-key')
      expect(customLocalStorage.getItem('test-storage-key')).to.equal(null)
    })

    it('converts persisted value', function () {
      const store = new ReactScopeValueStore()
      store.persisted('test-path', false, 'test-storage-key', {
        toPersisted: value => (value ? 'on' : 'off'),
        fromPersisted: persistedValue => persistedValue === 'on',
      })
      store.set('test-path', true)
      expect(customLocalStorage.getItem('test-storage-key')).to.equal('on')
    })
  })
})
