overleaf/notifications
===============

An API for managing user notifications in Overleaf


database indexes
================

For notification expiry to work, a TTL index on `notifications.expires` must be created:

```javascript
db.notifications.createIndex({expires: 1}, {expireAfterSeconds: 10})
```

License
=======
The code in this repository is released under the GNU AFFERO GENERAL PUBLIC LICENSE, version 3.

Copyright (c) Overleaf, 2016–2019.
