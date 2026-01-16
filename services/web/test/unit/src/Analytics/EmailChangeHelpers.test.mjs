import { vi, expect } from 'vitest'
import sinon from 'sinon'

describe('EmailChangeHelper', function () {
  let AnalyticsManager
  let UserGetter
  let EmailChangeHelpers
  const email = 'test@example.com'
  const userId = '507f1f77bcf86cd799439011'
  beforeEach(async function () {
    UserGetter = {
      promises: {
        getUserFullEmails: sinon.stub().resolves([]),
      },
    }
    AnalyticsManager = {
      registerEmailChange: sinon.stub(),
    }

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: AnalyticsManager,
      })
    )

    EmailChangeHelpers = (
      await import('../../../../app/src/Features/Analytics/EmailChangeHelper.mjs')
    ).default
  })

  describe('registerEmailUpdate', function () {
    describe('when the email cannot be matched', function () {
      beforeEach(function () {
        UserGetter.promises.getUserFullEmails.resolves([
          {
            email: 'test2@example.com',
            reversedHostname: 'moc.elpmaxe',
            createdAt: new Date('2023-01-01T00:00:00'),
            confirmedAt: new Date('2023-02-01T00:00:00'),
            default: false,
          },
        ])
      })

      it('calls registerEmailChange with the passed event data', async function () {
        const eventData = {
          emailCreatedAt: new Date('2024-01-01T00:00:00'),
          isPrimary: true,
        }
        await EmailChangeHelpers.registerEmailUpdate(userId, email, eventData)
        expect(AnalyticsManager.registerEmailChange).to.have.been.calledOnce
        const callArgs = AnalyticsManager.registerEmailChange.getCall(0).args[0]
        expect(callArgs).to.include({
          userId,
          email,
          action: 'updated',
          isPrimary: true,
        })
        expect(callArgs.emailCreatedAt).to.eql('2024-01-01T00:00:00.000Z')
        expect(callArgs.emailConfirmedAt).to.be.null
      })
    })
    describe('when the email can be matched', function () {
      beforeEach(function () {
        UserGetter.promises.getUserFullEmails.resolves([
          {
            email,
            reversedHostname: 'moc.elpmaxe',
            createdAt: new Date('2023-01-01T00:00:00'),
            confirmedAt: new Date('2023-02-01T00:00:00'),
            default: false,
          },
        ])
      })

      it('calls registerEmailChange with the email data', async function () {
        await EmailChangeHelpers.registerEmailUpdate(userId, email)
        expect(AnalyticsManager.registerEmailChange).to.have.been.calledOnce
        const callArgs = AnalyticsManager.registerEmailChange.getCall(0).args[0]
        expect(callArgs).to.include({
          userId,
          email,
          action: 'updated',
          isPrimary: false,
        })
        expect(callArgs.emailCreatedAt).to.eql('2023-01-01T00:00:00.000Z')
        expect(callArgs.emailConfirmedAt).to.eql('2023-02-01T00:00:00.000Z')
        expect(callArgs.emailDeletedAt).to.be.null
      })

      it('prefers supplied event data over fetched email data', async function () {
        const eventData = {
          emailCreatedAt: new Date('2024-01-01T00:00:00'),
          emailConfirmedAt: new Date('2024-02-01T00:00:00'),
          isPrimary: true,
        }
        await EmailChangeHelpers.registerEmailUpdate(userId, email, eventData)
        expect(AnalyticsManager.registerEmailChange).to.have.been.calledOnce
        const callArgs = AnalyticsManager.registerEmailChange.getCall(0).args[0]
        expect(callArgs).to.include({
          userId,
          email,
          action: 'updated',
          isPrimary: true,
        })
        expect(callArgs.emailCreatedAt).to.eql('2024-01-01T00:00:00.000Z')
        expect(callArgs.emailConfirmedAt).to.eql('2024-02-01T00:00:00.000Z')
        expect(callArgs.emailDeletedAt).to.be.null
      })
    })

    describe('when the user is not found', function () {
      beforeEach(function () {
        UserGetter.promises.getUserFullEmails.rejects(
          new Error('User not found')
        )
      })
      it('throws the error', async function () {
        await expect(
          EmailChangeHelpers.registerEmailUpdate(userId, email)
        ).to.eventually.be.rejectedWith('User not found')
      })
    })
  })

  describe('registerEmailCreation', function () {
    describe('when the email cannot be matched', function () {
      beforeEach(function () {
        UserGetter.promises.getUserFullEmails.resolves([
          {
            email: 'test2@example.com',
            reversedHostname: 'moc.elpmaxe',
            createdAt: new Date('2023-01-01T00:00:00'),
            confirmedAt: new Date('2023-02-01T00:00:00'),
            default: false,
          },
        ])
      })

      it('calls registerEmailChange with the passed event data', async function () {
        const eventData = {
          emailCreatedAt: new Date('2024-01-01T00:00:00'),
          isPrimary: true,
        }
        await EmailChangeHelpers.registerEmailCreation(userId, email, eventData)
        expect(AnalyticsManager.registerEmailChange).to.have.been.calledOnce
        const callArgs = AnalyticsManager.registerEmailChange.getCall(0).args[0]
        expect(callArgs).to.include({
          userId,
          email,
          action: 'created',
          isPrimary: true,
        })
        expect(callArgs.emailCreatedAt).to.eql('2024-01-01T00:00:00.000Z')
        expect(callArgs.emailConfirmedAt).to.be.null
        expect(callArgs.emailDeletedAt).to.be.null
      })
    })
    describe('when the email can be matched', function () {
      beforeEach(function () {
        UserGetter.promises.getUserFullEmails.resolves([
          {
            email,
            reversedHostname: 'moc.elpmaxe',
            createdAt: new Date('2023-01-01T00:00:00'),
            confirmedAt: new Date('2023-02-01T00:00:00'),
            default: false,
          },
        ])
      })

      it('calls registerEmailChange with the email data', async function () {
        await EmailChangeHelpers.registerEmailCreation(userId, email)
        expect(AnalyticsManager.registerEmailChange).to.have.been.calledOnce
        const callArgs = AnalyticsManager.registerEmailChange.getCall(0).args[0]
        expect(callArgs).to.include({
          userId,
          email,
          action: 'created',
          isPrimary: false,
        })
        expect(callArgs.emailCreatedAt).to.eql('2023-01-01T00:00:00.000Z')
        expect(callArgs.emailConfirmedAt).to.eql('2023-02-01T00:00:00.000Z')
        expect(callArgs.emailDeletedAt).to.be.null
      })

      it('prefers supplied event data over fetched email data', async function () {
        const eventData = {
          emailCreatedAt: new Date('2024-01-01T00:00:00'),
          emailConfirmedAt: new Date('2024-02-01T00:00:00'),
          isPrimary: true,
        }
        await EmailChangeHelpers.registerEmailCreation(userId, email, eventData)
        expect(AnalyticsManager.registerEmailChange).to.have.been.calledOnce
        const callArgs = AnalyticsManager.registerEmailChange.getCall(0).args[0]
        expect(callArgs).to.include({
          userId,
          email,
          action: 'created',
          isPrimary: true,
        })
        expect(callArgs.emailCreatedAt).to.eql('2024-01-01T00:00:00.000Z')
        expect(callArgs.emailConfirmedAt).to.eql('2024-02-01T00:00:00.000Z')
        expect(callArgs.emailDeletedAt).to.be.null
      })
    })
    describe('when the user is not found', function () {
      beforeEach(function () {
        UserGetter.promises.getUserFullEmails.rejects(
          new Error('User not found')
        )
      })
      it('throws the error', async function () {
        await expect(
          EmailChangeHelpers.registerEmailCreation(userId, email)
        ).to.eventually.be.rejectedWith('User not found')
      })
    })
  })

  describe('registerEmailDeletion', function () {
    describe('when the email cannot be matched', function () {
      beforeEach(function () {
        UserGetter.promises.getUserFullEmails.resolves([
          {
            email: 'test2@example.com',
            reversedHostname: 'moc.elpmaxe',
            createdAt: new Date('2023-01-01T00:00:00'),
            confirmedAt: new Date('2023-02-01T00:00:00'),
            default: false,
          },
        ])
      })

      it('calls registerEmailChange with the passed event data', async function () {
        const eventData = {
          emailCreatedAt: new Date('2024-01-01T00:00:00'),
          emailDeletedAt: new Date('2025-02-01T00:00:00'),
          isPrimary: true,
        }
        await EmailChangeHelpers.registerEmailDeletion(userId, email, eventData)
        expect(AnalyticsManager.registerEmailChange).to.have.been.calledOnce
        const callArgs = AnalyticsManager.registerEmailChange.getCall(0).args[0]
        expect(callArgs).to.include({
          userId,
          email,
          action: 'deleted',
          isPrimary: true,
        })
        expect(callArgs.emailCreatedAt).to.eql('2024-01-01T00:00:00.000Z')
        expect(callArgs.emailDeletedAt).to.eql('2025-02-01T00:00:00.000Z')
      })
    })

    describe('when the user is not found', function () {
      beforeEach(function () {
        UserGetter.promises.getUserFullEmails.rejects(
          new Error('User not found')
        )
      })
      it('throws the error', async function () {
        await expect(
          EmailChangeHelpers.registerEmailDeletion(userId, email)
        ).to.eventually.be.rejectedWith('User not found')
      })
    })
  })
})
