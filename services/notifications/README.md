notifications-sharelatex
===============

An API for managing user notifications in ShareLaTeX


database indexes
================

For notification expiry to work, a ttl index on `notifications.expiresFrom` must be created:

```javascript
db.notifications.createIndex({expiresFrom: 1}, {expireAfterSeconds: (60*60*24*30)})
```
