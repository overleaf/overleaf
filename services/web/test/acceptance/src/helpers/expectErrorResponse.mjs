import { expect } from 'chai'

export default {
  requireLogin: {
    json(response, body) {
      expect(response.statusCode).to.equal(401)
      expect(body).to.equal('Unauthorized')
      expect(response.headers['www-authenticate']).to.equal('OverleafLogin')
    },
  },

  restricted: {
    html(response, body) {
      expect(response.statusCode).to.equal(403)
      expect(body).to.match(/<head><title>Restricted/)
    },
    json(response, body) {
      expect(response.statusCode).to.equal(403)
      expect(body).to.deep.equal({ message: 'restricted' })
    },
  },
}
