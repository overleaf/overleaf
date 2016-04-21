var simple = require('simple-git');
var services = require('./sharelatex/config/services');
const fs = require('fs');

function print_latest(repoDir) {
  git = simple(repoDir);
  opt = [];
  opt['max-count'] = 1;
  git.log(opt, function(err, log) {
      if (!err) {
        console.log(repoDir + ',' + log.latest.hash);
      }
  })
}

for (id in services) {
  service = services[id];
  dirPath = __dirname + '/sharelatex/'+service.name;
  if (fs.existsSync(dirPath)) {
    print_latest(dirPath);
  }
}
