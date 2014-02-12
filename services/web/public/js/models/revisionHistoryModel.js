(function() {

  require(['jquery', 'libs/underscore'], function($) {
    var RevisionHistory;
    _.templateSettings = {
      interpolate: /\{\{(.+?)\}\}/g
    };
    RevisionHistory = (function() {

      function RevisionHistory(data) {
        var $trEntity, table, trEntity, trLocation;
        table = $('#revisionList');
        trLocation = table.dataTable().fnAddData([data.date, data.changedFiles.length]);
        trEntity = table.fnSettings().aoData[trLocation[0]].nTr;
        trEntity.setAttribute('revisionId', data.gitShar);
        console.log(trEntity);
        $trEntity = $(trEntity)[0];
        console.log($trEntity);
        $trEntity.click(function(e) {
          return console.log(data.gitShar);
        });
      }

      return RevisionHistory;

    })();
    console.log(1);
    $('#revisionList tr').click(function(e) {
      return console.log(e.target.parentNode);
    });
    window.RevisionHistory = RevisionHistory;
    return {
      RevisionHistory: RevisionHistory
    };
  });

}).call(this);
