import logger from '@overleaf/logger'
import { bibParse } from './BibParser.js'

// req: { allUrls: string[], fullIndex: boolean }
// res: { keys: string[]}
export default {
  index(req, res) {
    const { docUrls, fullIndex } = req.body;
    Promise.all(docUrls.map(async (docUrl) => {
      try {
        const response = await fetch(docUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      } catch (error) {
        logger.error({ error }, "Failed to fetch document from URL: " + docUrl);
        return null;
      }
    })).then((responses) => {
      const keys = [];
      for (const body of responses) {
        if (!body) continue
        try {
          const result = bibParse(body);
          const resultKeys = Object.keys(result);
          keys.push(...resultKeys);
        } catch(error) {
          logger.error({error}, "skip the file.")
        }
      }
      logger.info({ keys }, "all keys");
      res.send({ keys })
    })
  }
}
