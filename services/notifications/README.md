notifications-sharelatex
===============

An API for managing user notifications in ShareLaTeX


database indexes
================

For notification expiry to work, a TTL index on `notifications.expires` must be created:

```javascript
db.notifications.createIndex({expires: 1}, {expireAfterSeconds: 10})
```
