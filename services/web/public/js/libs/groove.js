!function(window) {

  window.Groove = {

    init: function(options) {
      this._options = options;
      if (typeof grooveOnReady != 'undefined') {grooveOnReady();}
    },

    createTicket: function(params, callback) {
      var postData = serialize({
        "ticket[enduser_name]": params["name"],
        "ticket[enduser_email]": params["email"],
        "ticket[title]": params["subject"],
        "ticket[enduser_about]": params["about"],
        "ticket[label_string]": params["labels"],
        "ticket[comments_attributes][0][body]": params["message"]
      });

      sendRequest(this._options.widget_ticket_url, function(req) {
        if (callback) {callback(req);}
      }, postData);
    }
  };

  // http://www.quirksmode.org/js/xmlhttp.html
  function sendRequest(url, callback, postData) {
    var req = createXMLHTTPObject();
    if (!req) return;
    var method = (postData) ? "POST" : "GET";
    req.open(method, url, true);
    if (postData){
      try {
        req.setRequestHeader('Content-type','application/x-www-form-urlencoded');
      }
      catch(e) {
        req.contentType = 'application/x-www-form-urlencoded';
      };
    };
    req.onreadystatechange = function () {
      if (req.readyState != 4) return;
      callback(req);
    }
    if (req.readyState == 4) return;
    req.send(postData);
  }

  var XMLHttpFactories = [
    function () {return new XDomainRequest()},
    function () {return new XMLHttpRequest()},
    function () {return new ActiveXObject("Msxml2.XMLHTTP")},
    function () {return new ActiveXObject("Msxml3.XMLHTTP")},
    function () {return new ActiveXObject("Microsoft.XMLHTTP")}
  ];

  function createXMLHTTPObject() {
    var xmlhttp = false;
    for (var i = 0; i < XMLHttpFactories.length; i++) {
      try {
        xmlhttp = XMLHttpFactories[i]();
      }
      catch (e) {
        continue;
      }
      break;
    }
    return xmlhttp;
  }

  function serialize(obj) {
    var str = [];
    for(var p in obj) {
      if (obj[p]) {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    }
    return str.join("&");
}

if (typeof grooveOnLoad != 'undefined') {grooveOnLoad();}
}(window);

Groove.init({"widget_ticket_url":"https://sharelatex-accounts.groovehq.com/widgets/f5ad3b09-7d99-431b-8af5-c5725e3760ce/ticket.json"});

