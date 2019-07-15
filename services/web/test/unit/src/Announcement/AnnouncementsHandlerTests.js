/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Announcements/AnnouncementsHandler'
)
const sinon = require('sinon')
const { expect } = require('chai')

describe('AnnouncementsHandler', function() {
  beforeEach(function() {
    this.user = {
      _id: '3c6afe000000000000000000', // 2002-02-14T00:00:00.000Z
      email: 'someone@gmail.com'
    }
    this.AnalyticsManager = { getLastOccurrence: sinon.stub() }
    this.BlogHandler = { getLatestAnnouncements: sinon.stub() }
    this.settings = {}
    return (this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Analytics/AnalyticsManager': this.AnalyticsManager,
        '../Blog/BlogHandler': this.BlogHandler,
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {}
        }
      }
    }))
  })

  describe('getUnreadAnnouncements', function() {
    beforeEach(function() {
      this.stubbedAnnouncements = [
        {
          date: new Date(1478836800000),
          id: '/2016/11/01/introducting-latex-code-checker'
        },
        {
          date: new Date(1308369600000),
          id: '/2013/08/02/thesis-series-pt1'
        },
        {
          date: new Date(1108369600000),
          id: '/2005/08/04/somethingelse'
        },
        {
          date: new Date(1208369600000),
          id: '/2008/04/12/title-date-irrelivant'
        }
      ]
      return this.BlogHandler.getLatestAnnouncements.callsArgWith(
        0,
        null,
        this.stubbedAnnouncements
      )
    })

    it('should mark all announcements as read is false', function(done) {
      this.AnalyticsManager.getLastOccurrence.callsArgWith(2, null, [])
      return this.handler.getUnreadAnnouncements(
        this.user,
        (err, announcements) => {
          announcements[0].read.should.equal(false)
          announcements[1].read.should.equal(false)
          announcements[2].read.should.equal(false)
          announcements[3].read.should.equal(false)
          return done()
        }
      )
    })

    it('should should be sorted again to ensure correct order', function(done) {
      this.AnalyticsManager.getLastOccurrence.callsArgWith(2, null, [])
      return this.handler.getUnreadAnnouncements(
        this.user,
        (err, announcements) => {
          announcements[3].should.equal(this.stubbedAnnouncements[2])
          announcements[2].should.equal(this.stubbedAnnouncements[3])
          announcements[1].should.equal(this.stubbedAnnouncements[1])
          announcements[0].should.equal(this.stubbedAnnouncements[0])
          return done()
        }
      )
    })

    it('should return older ones marked as read as well', function(done) {
      this.AnalyticsManager.getLastOccurrence.callsArgWith(2, null, {
        segmentation: { blogPostId: '/2008/04/12/title-date-irrelivant' }
      })
      return this.handler.getUnreadAnnouncements(
        this.user,
        (err, announcements) => {
          announcements[0].id.should.equal(this.stubbedAnnouncements[0].id)
          announcements[0].read.should.equal(false)

          announcements[1].id.should.equal(this.stubbedAnnouncements[1].id)
          announcements[1].read.should.equal(false)

          announcements[2].id.should.equal(this.stubbedAnnouncements[3].id)
          announcements[2].read.should.equal(true)

          announcements[3].id.should.equal(this.stubbedAnnouncements[2].id)
          announcements[3].read.should.equal(true)

          return done()
        }
      )
    })

    it('should return all of them marked as read', function(done) {
      this.AnalyticsManager.getLastOccurrence.callsArgWith(2, null, {
        segmentation: {
          blogPostId: '/2016/11/01/introducting-latex-code-checker'
        }
      })
      return this.handler.getUnreadAnnouncements(
        this.user,
        (err, announcements) => {
          announcements[0].read.should.equal(true)
          announcements[1].read.should.equal(true)
          announcements[2].read.should.equal(true)
          announcements[3].read.should.equal(true)
          return done()
        }
      )
    })

    it('should return posts older than signup date as read', function(done) {
      this.stubbedAnnouncements.push({
        date: new Date(978836800000),
        id: '/2001/04/12/title-date-irrelivant'
      })
      this.AnalyticsManager.getLastOccurrence.callsArgWith(2, null, [])
      return this.handler.getUnreadAnnouncements(
        this.user,
        (err, announcements) => {
          announcements[0].read.should.equal(false)
          announcements[1].read.should.equal(false)
          announcements[2].read.should.equal(false)
          announcements[3].read.should.equal(false)
          announcements[4].read.should.equal(true)
          announcements[4].id.should.equal('/2001/04/12/title-date-irrelivant')
          return done()
        }
      )
    })

    describe('with custom domain announcements', function() {
      beforeEach(function() {
        this.stubbedDomainSpecificAnn = [
          {
            domains: ['gmail.com', 'yahoo.edu'],
            title: 'some message',
            excerpt: 'read this',
            url: 'http://www.sharelatex.com/i/somewhere',
            id: 'iaaa',
            date: new Date(1308369600000).toString()
          }
        ]

        return (this.handler._domainSpecificAnnouncements = sinon
          .stub()
          .returns(this.stubbedDomainSpecificAnn))
      })

      it('should insert the domain specific in the correct place', function(done) {
        this.AnalyticsManager.getLastOccurrence.callsArgWith(2, null, [])
        return this.handler.getUnreadAnnouncements(
          this.user,
          (err, announcements) => {
            announcements[4].should.equal(this.stubbedAnnouncements[2])
            announcements[3].should.equal(this.stubbedAnnouncements[3])
            announcements[2].should.equal(this.stubbedAnnouncements[1])
            announcements[1].should.equal(this.stubbedDomainSpecificAnn[0])
            announcements[0].should.equal(this.stubbedAnnouncements[0])
            return done()
          }
        )
      })
    })

    describe('_domainSpecificAnnouncements', function() {
      beforeEach(function() {
        return (this.settings.domainAnnouncements = [
          {
            domains: ['gmail.com', 'yahoo.edu'],
            title: 'some message',
            excerpt: 'read this',
            url: 'http://www.sharelatex.com/i/somewhere',
            id: 'id1',
            date: new Date(1308369600000).toString()
          },
          {
            domains: ['gmail.com', 'yahoo.edu'],
            title: 'some message',
            excerpt: 'read this',
            url: 'http://www.sharelatex.com/i/somewhere',
            date: new Date(1308369600000).toString()
          },
          {
            domains: ['gmail.com', 'yahoo.edu'],
            title: 'some message',
            excerpt: 'read this',
            url: 'http://www.sharelatex.com/i/somewhere',
            id: 'id3',
            date: new Date(1308369600000).toString()
          }
        ])
      })

      it("should filter announcments which don't have an id", function(done) {
        const result = this.handler._domainSpecificAnnouncements(
          'someone@gmail.com'
        )
        result.length.should.equal(2)
        result[0].id.should.equal('id1')
        result[1].id.should.equal('id3')
        return done()
      })

      it('should match on domain', function(done) {
        this.settings.domainAnnouncements[2].domains = ['yahoo.com']
        const result = this.handler._domainSpecificAnnouncements(
          'someone@gmail.com'
        )
        result.length.should.equal(1)
        result[0].id.should.equal('id1')
        return done()
      })
    })
  })
})
