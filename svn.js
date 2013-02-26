this.SVN = function (usname, passwd, base) {
    var auth = btoa(usname + ':' + passwd);
    this.dav = new Dav(auth, base);
    this.handlers = [];
};
this.SVN.prototype = {
    add: function (path, content) {
        this.handlers.push({
            method: 'PUT',
            params: [path, content]
        });
    },
    del: function (path) {
        this.handlers.push({
            method: 'DELETE',
            params: [path]
        });
    },
    copy: function (path, topath) {

    },
    move: function (path, topath) {
        this.handlers.push({
            method: 'DELETE',
            params: [path]
        }, {
            method: 'COPY',
            params: [path, topath]
        });
    },
    lock: function () {

    },
    unlock: function () {

    },
    mkdir: function (name) {
        this.handlers.push({
            method: 'MKCOL',
            params: [name]
        });
    },
    propset: function (path, props) {
        this.handlers.push({
            method: 'PROPPATCH',
            params: [
                path, { set: props }
            ]
        });
    },
    propdel: function (path, props) {
        this.handlers.push({
            method: 'PROPPATCH',
            params: [
                path, { del: props }
            ]
        });
    },
    commit: function (message) {
        var self = this;
        var dav = self.dav;
        self.message = message || 'update';
        dav.log('================================================');
        dav.OPTIONS(function () {
            dav.PROPFIND(dav.basepath, function (stat) {
                if (stat == '207')
                    self._mkAct();
                else
                    dav.log('Error at step PROPFIND', 1);
            });
        });
    },
    _mkAct: function () {
        var self = this;
        var dav = self.dav;
        dav.MKACTIVITY(function () {
            dav.CHECKOUT(dav.vcc, function () {
                self._patchLog();
            });
        });
    },
    _patchLog: function () {
        var self = this;
        var dav = self.dav;
        var message = self.message;
        dav.PROPPATCH(dav.co, {
            set: {
                log: message
            }
        }, function () {
            self._process();
        });
    },
    _process: function () {
        var self = this;
        var dav = self.dav;
        var handler = self.handlers.shift();
        var method = handler.method;
        var params = handler.params;
        params.push(function () {
            if (self.handlers.length)
                self._process();
            else
                self._merge();
        });
        var url = self._getCheckoutUrl(method, params[0]);
        dav.CHECKOUT(url, function () {
            if (method == 'PROPPATCH')
                params[0] = dav.co;
            else if (method == 'MKCOL')
                params[0] = dav.co + '/' + params[0];
            dav[method].apply(dav, params);
        });
    },
    _getCheckoutUrl: function (method, path) {
        var url = dav.ci;
        var pos = path.indexOf('/');
        if (method == 'PROPPATCH' || pos > -1)
            url += '/' + path;
    },
    _merge: function () {
        var dav = this.dav;
        dav.MERGE(function () {
            dav.log('ALL DONE!');
            dav.log('================================================');
        });
    }
};

!function (proto) {
    proto.rm = proto.remove = proto['delete'] = proto.del;
    proto.mv = proto.rename = proto.ren = proto.move;
    proto.up = proto.update;
    proto.pset = proto.ps = proto.propset;
    proto.pdel = proto.pd = proto.propdel;
}(this.SVN.prototype);
