// Run babel on tests to allow support for import/export statements in Node
require('@babel/register')

// Load JSDOM to mock the DOM in Node
require('jsdom-global/register')

// Load sinon-chai assertions so expect(stubFn).to.have.been.calledWith('abc')
// has a nicer failure messages
const chai = require('chai')
chai.use(require('sinon-chai'))
