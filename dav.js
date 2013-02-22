var Dav = function (auth, basepath) {
    this.auth = auth;
    this.basepath = basepath;
    this.uniqueKey = this._getUniqueKey();
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
  // seems that there's some bug in IE (or Sarissa?) that 
  // makes it spew out '1223' status codes when '204' is
  // received... needs some investigation later on
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
Dav.prototype = function () {
    var self = {};
    self.constructor = Dav;
    self.request = function (options) {
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
    };
    self._parseMultiStatus = function (txt) {
        
    };
    self._getXMLHttp = function () {
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
    self.OPTIONS = function (ok, err) {
        self.request({
            type: 'OPTIONS',
            path: self.basepath,
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
    };
    self.PROPFIND = function (ok, err) {
        self.request({
            type: 'PROPFIND',
            path: self.basepath,
            headers: {
                'Depth': 0,
                'Content-type': 'text/xml;charset=utf-8',
                'Accept-Encoding': 'gzip'
            },
            content: [
                '<?xml version="1.0" encoding="utf-8"?>',
                '<D:propfind xmlns="DAV:"><D:allprop />',
                '</D:propfind>'
            ].join(''),
            handler: function (stat, statstr, cont) {
                if (stat == '207') {
                    self.log('##### PROPFIND request success #####');
                    var rvcc = new RegExp([
                        'version-controlled-configuration>',
                        '<D:href>([^<]+)<\\/D:href>'
                    ].join(''));
                    self.vcc = cont.match(rvcc)[1];
                    self.log('version-conctrolled-configuratoin: ' + self.vcc);
                    self.log('##### PROPFIND INFO END #####');
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### PROPFIND request fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('##### PROPFIND INFO END #####', 1);
                    err && err(stat, statstr, cont);
                }
            }
        });
    };

    self.MKACTIVITY = function (ok, err) {
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
                    err && err(stat, statstr, cont);
                }
            }
        });
    };

    self.CHECKOUT = function (path, actpath, ok, err) {
        self.request({
            type: 'CHECKOUT',
            path: path,
            headers: {
                'Accept-Encoding': 'gzip',
                'Authorization': self.auth
            },
            content: [
                '<?xml version="1.0" encoding="utf-8"?>',
                '<D:checkout xmlns:D="DAV:">',
                '<D:activity-set><D:href>', atcpath, '</D:href>',
                '</D:activity-set><D:apply-to-version/></D:checkout>'
            ].join(''),
            handler: function (stat, statstr, cont) {
                if (stat == '201') {
                    self.log('##### CHECKOUT ' + path + ' success #####');
                    var rwbl = /<\w+>([^<]+)</\w+>/;
                    var info = cont.match(rwbl)[1];
                    self.wbl = info.replace(/^Checked-out resource /, '')
                                   .replace(/ has been created\.$/, '');
                    self.log(info);
                    self.log('#### CHECKOUT INFO END #####');
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### CHECKOUT ' + path + ' fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('#### CHECKOUT INFO END #####');
                    err && err(stat, statstr, cont);
                }
            }
        });
    };

    self.PROPPATCH = function (info, ok, err) {
        self.request({
            type: 'PROPPATCH',
            path: self.wbl,
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
                '<S:log >', info, '</S:log>',
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
                }
            }
        });
    };

    self.PUT = function (path, content, ok, err) {
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
                }
            }
        });
    };

    self.DELETE = function (path, ok, err) {
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
                }
            }
        });
    };

    self.MERGE = function (ok, err) {
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
                    ok && ok(stat, statstr, cont);
                } else {
                    self.log('##### MERGE fail #####', 1);
                    self.log(stat + ' ' + statstr, 1);
                    self.log('##### MERGE INFO END #####', 1);
                    err && err(stat, statstr, cont);
                }
            }
        });
    };

    self._getUniqueKey = function () {
        var key = [];
        var lens = [8, 4, 4, 4, 12];
        for (var i = 0; i < 5; i++) {
            var len = lens[i];
            var arr = [];
            for (var j = 0; j < len; j++)
                arr.push(self._getRandomChar());
            key.push(arr.join(''));
        }
        return key.join('-');
    };

    self._getRandomChar = function () {
        var source = '0123456789abcdefghijklmnopqrstuvwxyz';
        return source.charAt(
            Math.round(
                Math.random() * 36)
        );
    };

    self.log = function (str, bad) {
        var color = bad ? 'red' : 'green';
        var txtnode = document.createElement('p');
        txtnode.style.color = color;
        txtnode.innerHTML = str;
        Dav.console.appendChild(txtnode);
    };

    return self;
}();

!function () {
    var div = Dav.console = document.createElement('div');
    div.style.cssText = [
        'position:fixed;z-index:999999;overflow-y:auto;width:500px;',
        'left:50%;padding:10px;margin-left:-250px;background:#111;',
        'border-radius:10px;box-shadow:0 0 10px #999;display:none;'
    ].join('');
    document.appendChild(div);
}();
