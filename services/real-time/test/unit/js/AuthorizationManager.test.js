import { beforeEach, describe, chai, expect, it } from 'vitest'
import sinon from 'sinon'

chai.should()

const modulePath = '../../../app/js/AuthorizationManager'

describe('AuthorizationManager', () => {
  beforeEach(async ctx => {
    ctx.client = { ol_context: {} }

    ctx.AuthorizationManager = (await import(modulePath)).default
  })

  describe('assertClientCanViewProject', () => {
    it('should allow the readOnly privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'readOnly'
        ctx.AuthorizationManager.assertClientCanViewProject(
          ctx.client,
          error => {
            expect(error).to.be.null
            resolve()
          }
        )
      })
    })

    it('should allow the readAndWrite privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'readAndWrite'
        ctx.AuthorizationManager.assertClientCanViewProject(
          ctx.client,
          error => {
            expect(error).to.be.null
            resolve()
          }
        )
      })
    })

    it('should allow the review privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'review'
        ctx.AuthorizationManager.assertClientCanViewProject(
          ctx.client,
          error => {
            expect(error).to.be.null
            resolve()
          }
        )
      })
    })

    it('should allow the owner privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'owner'
        ctx.AuthorizationManager.assertClientCanViewProject(
          ctx.client,
          error => {
            expect(error).to.be.null
            resolve()
          }
        )
      })
    })

    it('should return an error with any other privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'unknown'
        ctx.AuthorizationManager.assertClientCanViewProject(
          ctx.client,
          error => {
            error.message.should.equal('not authorized')
            resolve()
          }
        )
      })
    })
  })

  describe('assertClientCanEditProject', () => {
    it('should not allow the readOnly privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'readOnly'
        ctx.AuthorizationManager.assertClientCanEditProject(
          ctx.client,
          error => {
            error.message.should.equal('not authorized')
            resolve()
          }
        )
      })
    })

    it('should allow the readAndWrite privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'readAndWrite'
        ctx.AuthorizationManager.assertClientCanEditProject(
          ctx.client,
          error => {
            expect(error).to.be.null
            resolve()
          }
        )
      })
    })

    it('should allow the owner privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'owner'
        ctx.AuthorizationManager.assertClientCanEditProject(
          ctx.client,
          error => {
            expect(error).to.be.null
            resolve()
          }
        )
      })
    })

    it('should return an error with any other privilegeLevel', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.client.ol_context.privilege_level = 'unknown'
        ctx.AuthorizationManager.assertClientCanEditProject(
          ctx.client,
          error => {
            error.message.should.equal('not authorized')
            resolve()
          }
        )
      })
    })
  })

  // check doc access for project

  describe('assertClientCanViewProjectAndDoc', () => {
    beforeEach(ctx => {
      ctx.doc_id = '12345'
      ctx.callback = sinon.stub()
      ctx.client.ol_context = {}
    })

    describe('when not authorised at the project level', () => {
      beforeEach(ctx => {
        ctx.client.ol_context.privilege_level = 'unknown'
      })

      it('should not allow access', ctx => {
        ctx.AuthorizationManager.assertClientCanViewProjectAndDoc(
          ctx.client,
          ctx.doc_id,
          err => err.message.should.equal('not authorized')
        )
      })

      describe('even when authorised at the doc level', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              err => {
                if (err) return reject(err)
                resolve()
              }
            )
          })
        })

        it('should not allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })

    describe('when authorised at the project level', () => {
      beforeEach(ctx => {
        ctx.client.ol_context.privilege_level = 'readOnly'
      })

      describe('and not authorised at the document level', () => {
        it('should not allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })

      describe('and authorised at the document level', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              err => {
                if (err) return reject(err)
                resolve()
              }
            )
          })
        })

        it('should allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            ctx.callback
          )
          ctx.callback.calledWith(null).should.equal(true)
        })
      })

      describe('when document authorisation is added and then removed', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              () => {
                ctx.AuthorizationManager.removeAccessToDoc(
                  ctx.client,
                  ctx.doc_id,
                  err => {
                    if (err) return reject(err)
                    resolve()
                  }
                )
              }
            )
          })
        })

        it('should deny access', ctx => {
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })
  })

  describe('assertClientCanEditProjectAndDoc', () => {
    beforeEach(ctx => {
      ctx.doc_id = '12345'
      ctx.callback = sinon.stub()
      ctx.client.ol_context = {}
    })

    describe('when not authorised at the project level', () => {
      beforeEach(ctx => {
        ctx.client.ol_context.privilege_level = 'readOnly'
      })

      it('should not allow access', ctx => {
        ctx.AuthorizationManager.assertClientCanEditProjectAndDoc(
          ctx.client,
          ctx.doc_id,
          err => err.message.should.equal('not authorized')
        )
      })

      describe('even when authorised at the doc level', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              err => {
                if (err) return reject(err)
                resolve()
              }
            )
          })
        })

        it('should not allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })

    describe('when authorised at the project level', () => {
      beforeEach(ctx => {
        ctx.client.ol_context.privilege_level = 'readAndWrite'
      })

      describe('and not authorised at the document level', () => {
        it('should not allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })

      describe('and authorised at the document level', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              err => {
                if (err) return reject(err)
                resolve()
              }
            )
          })
        })

        it('should allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            ctx.callback
          )
          ctx.callback.calledWith(null).should.equal(true)
        })
      })

      describe('when document authorisation is added and then removed', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              () => {
                ctx.AuthorizationManager.removeAccessToDoc(
                  ctx.client,
                  ctx.doc_id,
                  err => {
                    if (err) return reject(err)
                    resolve()
                  }
                )
              }
            )
          })
        })

        it('should deny access', ctx => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })
  })

  describe('assertClientCanReviewProjectAndDoc', () => {
    beforeEach(ctx => {
      ctx.doc_id = '12345'
      ctx.callback = sinon.stub()
      ctx.client.ol_context = {}
    })

    describe('when not authorised at the project level', () => {
      beforeEach(ctx => {
        ctx.client.ol_context.privilege_level = 'readOnly'
      })

      it('should not allow access', ctx => {
        ctx.AuthorizationManager.assertClientCanReviewProjectAndDoc(
          ctx.client,
          ctx.doc_id,
          err => err.message.should.equal('not authorized')
        )
      })

      describe('even when authorised at the doc level', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              err => {
                if (err) return reject(err)
                resolve()
              }
            )
          })
        })

        it('should not allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanReviewProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })

    describe('when authorised at the project level', () => {
      beforeEach(ctx => {
        ctx.client.ol_context.privilege_level = 'review'
      })

      describe('and not authorised at the document level', () => {
        it('should not allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanReviewProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })

      describe('and authorised at the document level', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              err => {
                if (err) return reject(err)
                resolve()
              }
            )
          })
        })

        it('should allow access', ctx => {
          ctx.AuthorizationManager.assertClientCanReviewProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            ctx.callback
          )
          ctx.callback.calledWith(null).should.equal(true)
        })
      })

      describe('when document authorisation is added and then removed', () => {
        beforeEach(async ctx => {
          await new Promise((resolve, reject) => {
            ctx.AuthorizationManager.addAccessToDoc(
              ctx.client,
              ctx.doc_id,
              () => {
                ctx.AuthorizationManager.removeAccessToDoc(
                  ctx.client,
                  ctx.doc_id,
                  err => {
                    if (err) return reject(err)
                    resolve()
                  }
                )
              }
            )
          })
        })

        it('should deny access', ctx => {
          ctx.AuthorizationManager.assertClientCanReviewProjectAndDoc(
            ctx.client,
            ctx.doc_id,
            err => err.message.should.equal('not authorized')
          )
        })
      })
    })
  })
})
