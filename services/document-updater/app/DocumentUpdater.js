(function(exports){
  Ace = require('aceserverside-sharelatex')
  Range = Ace.Range

  //look at applyDeltas method
  exports.applyChange = function(aceDoc, change, callback) {
    var r = change.range;
    var range = new Range(r.start.row, r.start.column, r.end.row, r.end.column);
    if('insertText'==change.action){
      aceDoc.insert(change.range.start, change.text);
    }else if('insertLines'==change.action){
      aceDoc.insertLines(change.range.start.row, change.lines);
    }else if('removeText'==change.action){
      aceDoc.remove(range);
    }else if('removeLines'==change.action){
      aceDoc.removeLines(range.start.row, range.end.row-1);
    }

    if(typeof callback === 'function'){
      callback(null, aceDoc);
    };
  }

})(typeof exports === 'undefined'? this['documentUpdater']={}: exports);





























































































































































