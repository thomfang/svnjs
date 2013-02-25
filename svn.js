var svn = function (opts) {
    
    var dav = new Dav(opts.auth, opts.basepath, opts.loginfo);

    
    var request = {
        start: function () {
            dav.log('================================================');
            dav.OPTIONS(function () {
                dav.PROPFIND(dav.basepath, function (stat) {
                    if (stat == '207')
                        request.mkAct();
                    else
                        dav.log('Error at step PROPFIND', 1);
                });
            });
        },
        mkAct: function () {
            dav.MKACTIVITY(function () {
                dav.CHECKOUT(dav.vcc, function () {
                    request.proppatch();
                });
            });
        },
        proppatch: function () {
            dav.PROPPATCH(function () {
                dav.CHECKOUT(dav.ci, function () {
                    request.handleFile();
                });
            });
        },
        handleFile: function () {
            var handler = opts.handlers.shift();
            var method = handler.method;
            var params = handler.params;
            params.push(function () {
                if (opts.handlers.length)
                    request.handleFile();
                else
                    request.merge();
            });
            dav[method].apply(dav, params);
        },
        merge: function () {
            dav.MERGE(function () {
                dav.log('ALL DONE!');
                dav.log('================================================');
            });
        }
    };

    request.start();
};
