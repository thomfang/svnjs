var Dav = function (auth, basepath, log) {
    this.loginfo = log;
    this.auth = 'Basic ' + auth;
    this.basepath = basepath;
};

var STATUS_CODES = {
  '100': 'Continue',
  '101': 'Switching Protocols',
  '102': 'Processing',
  '200': 'OK',
  '201': 'Created',
  '202': 'Accepted',
  '203': 'None-Authoritive Information',
  '204': 'No Content',
  '1223': 'No Content',
  '205': 'Reset Content',
  '206': 'Partial Content',
  '207': 'Multi-Status',
  '300': 'Multiple Choices',
  '301': 'Moved Permanently',
  '302': 'Found',
  '303': 'See Other',
  '304': 'Not Modified',
  '305': 'Use Proxy',
  '307': 'Redirect',
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '402': 'Payment Required',
  '403': 'Forbidden',
  '404': 'Not Found',
  '405': 'Method Not Allowed',
  '406': 'Not Acceptable',
  '407': 'Proxy Authentication Required',
  '408': 'Request Time-out',
  '409': 'Conflict',
  '410': 'Gone',
  '411': 'Length Required',
  '412': 'Precondition Failed',
  '413': 'Request Entity Too Large',
  '414': 'Request-URI Too Large',
  '415': 'Unsupported Media Type',
  '416': 'Requested range not satisfiable',
  '417': 'Expectation Failed',
  '422': 'Unprocessable Entity',
  '423': 'Locked',
  '424': 'Failed Dependency',
  '500': 'Internal Server Error',
  '501': 'Not Implemented',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',
  '504': 'Gateway Time-out',
  '505': 'HTTP Version not supported',
  '507': 'Insufficient Storage'
};
Dav.prototype = {

    request : function (options) {
        var self = this;
        var xhr = self._getXMLHttp();
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                var stat = xhr.status.toString();
                var cont = xhr.responseText;
                var statstr = STATUS_CODES[stat];
                options.handler &&
                    options.handler(stat, statstr, cont);
                xhr = null;
            }
        };
        xhr.open(options.type, options.path, true);
        if (options.headers)
            for(var key in options.headers) {
                var val = options.headers[key];
                xhr.setRequestHeader(key, val);
            }
        xhr.send(options.content);
    },
    
    _getXMLHttp : function () {
        var self = this;
        var methods = [
            function () {
                return new XMLHttpRequest();
            },
            function () {
                return new ActiveXObject('Microsoft.XMLHTTP');
            }
        ];
        for (var i = 0, func; func = methods[i]; i++) {
            try {
                self._getXMLHttp = func;
                return func();
            } catch(e) { }
        }
        throw new Error('Your browser not supported XMLHttpRequest');
    },

    OPTIONS : function (ok, err) {
        var self = this;
        self.request({
            type: 'OPTIONS',
            path: this.basepath,
            headers: {
                'Content-type': 'text/xml;charset=utf-8',
                'Accept-Encoding': 'gzip'
            },
            handler: function (stat, statstr, cont) {
                if (stat == '200') {
                    self.log('##### OPTIONS request success #####');
                    var ract = new RegExp([
                        '<D:activity-collection-set>',
                        '<D:href>([^<]+)<\\/D:href>'
                    ].join(''));
                    self.act = cont.match(ract)[1];
                    self.uniqueKey = self._getUniqueKey();
                    self.log('Acitivity path is: ' + self.act);
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### OPTIONS request fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('##### OPTIONS INFO END #####', 1);
                    err && err(stat, statstr, cont);
                }
            },
            content: [
                '<?xml version="1.0" encoding="utf-8"?>',
                '<D:options xmlns:D="DAV:">',
                '<D:activity-collection-set/>',
                '</D:options>'
            ].join('')
        });
    },

    PROPFIND : function (path, handler) {
        var self = this;
        self.request({
            type: 'PROPFIND',
            path: path,
            headers: {
                'Depth': 0,
                'Content-type': 'text/xml;charset=utf-8',
                'Accept-Encoding': 'gzip'
            },
            content: [
                '<?xml version="1.0" encoding="utf-8"?>',
                '<D:propfind xmlns:D="DAV:"><D:allprop />',
                '</D:propfind>'
            ].join(''),
            handler: function (stat, statstr, cont) {
                self.log('##### PROPFIND request #####');
                self.log(stat + ' ' + statstr);
                
                if (stat == '207') {
                    var rvcc = new RegExp([
                        'version-controlled-configuration>',
                        '<D:href>([^<]+)<\\/D:href>'
                    ].join(''));
                    var rci = new RegExp(
                        ':checked-in><D:href>([^<]+)<\\/D:href>');
                    self.vcc = cont.match(rvcc)[1];
                    self.ci = cont.match(rci)[1];
                    self.log('checked-in: ' + self.ci);
                    self.log('version-conctrolled-configuratoin: ' + self.vcc);
                }
                handler(stat, statstr, cont);
                self.log('##### PROPFIND INFO END #####');
            }
        });
    },

    MKACTIVITY : function (ok, err) {
        var self = this;
        self.request({
            type: 'MKACTIVITY',
            path: self.act + self.uniqueKey,
            headers: {
                'Accept-Encoding': 'gzip',
                'Authorization': self.auth
            },
            handler: function (stat, statstr, cont) {
                if (stat == '201') {
                    self.log('##### MKACTIVITY request success #####');
                    self.log('Activity ' + self.act + self.uniqueKey);
                    self.log('##### MKACTIVITY INFO END #####');
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### MKACTIVITY request fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    err && err(stat, statstr, cont);
                }
            }
        });
    },

    CHECKOUT : function (path, actpath, ok, err) {
        var self = this;
        self.request({
            type: 'CHECKOUT',
            path: path,
            headers: {
                'Accept-Encoding': 'gzip',
                'Authorization': self.auth,
                'Content-type': 'text/xml;charset=utf-8'
            },
            content: [
                '<?xml version="1.0" encoding="utf-8"?>',
                '<D:checkout xmlns:D="DAV:">',
                '<D:activity-set><D:href>', actpath, '</D:href>',
                '</D:activity-set><D:apply-to-version/></D:checkout>'
            ].join(''),
            handler: function (stat, statstr, cont) {
                if (stat == '201') {
                    self.log('##### CHECKOUT ' + path + ' success #####');
                    var rco = /<\w+>(Checked-out [^<]+)<\/\w+>/;
                    var info = cont.match(rco)[1];
                    self.co = info.replace(/^Checked-out resource /, '')
                                   .replace(/ has been created\.$/, '');
                    self.log(info);
                    self.log('#### CHECKOUT INFO END #####');
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### CHECKOUT ' + path + ' fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('#### CHECKOUT INFO END #####');
                    self.rmact();
                    err && err(stat, statstr, cont);
                }
            }
        });
    },

    PROPPATCH : function (ok, err) {
        var self = this;
        self.request({
            type: 'PROPPATCH',
            path: self.co,
            headers: {
                'Content-type': 'text/xml;charset=utf-8',
                'Accept-Encoding': 'gzip',
                'Authorization': self.auth
            },
            content: [
                '<?xml version="1.0" encoding="utf-8" ?>',
                '<D:propertyupdate xmlns:D="DAV:"',
                ' xmlns:V="http://subversion.tigris.org/xmlns/dav/"',
                ' xmlns:C="http://subversion.tigris.org/xmlns/custom/"', 
                ' xmlns:S="http://subversion.tigris.org/xmlns/svn/">',
                '<D:set><D:prop>',
                '<S:log >', self.loginfo, '</S:log>',
                '</D:prop></D:set></D:propertyupdate>'
            ].join(''),
            handler: function (stat, statstr, cont) {
                if (stat == '207') {
                    self.log('##### PROPPATCH success #####');
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### PROPPATCH fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('##### PROPPATCH INFO END #####', 1);
                    self.rmact();
                    err && err(stat, statstr, cont);
                }
            }
        });
    },

    PUT : function (path, content, ok, err) {
        var self = this;
        self.request({
            type: 'PUT',
            path: path,
            headers: {
                'Content-type': 'application/vnd.svn-svndiff',
                'Authorization': self.auth,
                'Accept-Encoding': 'gzip'
            },
            content: self._parse2svndiff(content),
            handler: function (stat, statstr, cont) {
                if (stat == '201') {
                    self.log('##### PUT ' + path + ' success #####');
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### PUT ' + path + ' fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('##### PUT INFO END #####', 1);
                    self.rmact();
                    err && err(stat, statstr, cont);
                }
            }
        });
    },

    DELETE : function (path, ok, err) {
        var self = this;
        self.request({
            type: 'DELETE',
            path: path,
            headers: {
                'Authorization': self.auth
            },
            handler: function (stat, statstr, cont) {
                if (stat == '204') {
                    self.log('##### DELETE ' + path + ' done #####');
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### DELETE ' + path + ' fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('##### DELETE INFO END #####', 1);
                    err && err(stat, statstr, cont);
                }
            }
        });
    },

    MOVE : function () {
        var self = this;
        self.request({
            type: 'MOVE',
            path: path,
            headers: {

            },
            handler: function (stat, statstr, cont) {

            }
        });
    },

    COPY : function (path, topath, ok, err) {
        var self = this;
        self.request({
            type: 'COPY',
            path: path,
            headers: {

            },
            handler: function (stat, statstr, cont) {

            }
        });
    },

    MKCOL : function () {
        var self = this;
        self.request({
            type: 'MKCOL',
            path: path,
            headers: {

            },
            handler: function (stat, statstr, cont) {

            }
        });
    },

    LOCK : function () {
        var self = this;
        self.request({
            type: 'LOCK',
            path: path,
            headers: {

            },
            handler: function (stat, statstr, cont) {

            }
        });
    },

    UNLOCK : function () {
        var self = this;
        self.request({
            type: 'UNLOCK',
            headers: {

            },
            handler: function (stat, statstr, cont) {

            }
        });
    },

    MERGE : function (ok, err) {
        var self = this;
        self.request({
            type: 'MERGE',
            path: self.act + self.uniqueKey,
            headers: {
                'X-SVN-Options': 'release-locks',
                'Content-type': 'text/xml;charset=utf-8',
                'Accept-Encoding': 'gzip',
                'Authorization': self.auth
            },
            content: [
                '<?xml version="1.0" encoding="utf-8"?>',
                '<D:merge xmlns:D="DAV:"><D:source>',
                '<D:href>', self.act, self.uniqueKey, '</D:href>',
                '</D:source><D:no-auto-merge/><D:no-checkout/>',
                '<D:prop><D:checked-in/><D:version-name/>',
                '<D:resourcetype/><D:creationdate/>',
                '<D:creator-displayname/></D:prop></D:merge>'
            ].join(''),
            handler: function (stat, statstr, cont) {
                if (stat == '200') {
                    self.log('##### MERGE done #####');
                    self.rmact(ok);
                } else {
                    self.log('##### MERGE fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('##### MERGE INFO END #####', 1);
                    err && err(stat, statstr, cont);
                    self.rmact();
                }
            }
        });
    },

    rmact : function (callback) {
        var self = this;
        self.DELETE(self.act + self.uniqueKey,
                    function (stat, statstr, cont) {
            callback && callback(stat, statstr, cont);
        });
    },

    _getUniqueKey : function () {
        var key = [];
        var lens = [8, 4, 4, 4, 12];
        for (var i = 0; i < 5; i++) {
            var len = lens[i];
            var arr = [];
            for (var j = 0; j < len; j++)
                arr.push(this._getRandomChar());
            key.push(arr.join(''));
        }
        return key.join('-');
    },

    _getRandomChar : function () {
        var source = '0123456789abcdefghijklmnopqrstuvwxyz';
        return source.charAt(
            Math.round(
                Math.random() * 36)
        );
    },

    log : function (str, bad) {
        var color = bad ? 'red' : 'green';
        var txtnode = document.createElement('p');
        txtnode.style.color = color;
        txtnode.innerHTML = str;
        Dav.console.appendChild(txtnode);
    }
};

!function () {
    var div = Dav.console = document.createElement('div');
    div.style.cssText = [
        'position:fixed;z-index:999999;overflow-y:auto;width:500px;',
        'left:50%;padding:10px;margin-left:-250px;background:#111;',
        'border-radius:10px;box-shadow:0 0 10px #999;font-family:monaco;',
        'font-size:14px;height:', document.documentElement.clientHeight, 'px;'
    ].join('');
    document.body.appendChild(div);
}();
