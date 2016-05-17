/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', './cornerMenu', 'cookies', 'modal', 'configurationActions'], function(exports, checkerboard, m, autoconnect, login, cornerMenu, cookies, modal, configurationActions) {
  function gup( name, url ) {
    if (!url) url = location.href;
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( url );
    return results === null ? null : results[1];
  }

  /* jshint ignore:start */
  var wsAddress = 'ws://' + window.location.hostname + ':' + {{ws}};
  /* jshint ignore:end */  var stm = new checkerboard.STM(wsAddress);
  autoconnect.monitor(stm.ws);

  document.body.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  document.body.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  var loadApp;
  stm.init(function(store) {
    configurationActions.load(stm);
    store.sendAction('init');
    var el = document.getElementById('root');
    var classroom, student;
    store.addObserver(function(){});

    var loadedApp;
    loadApp = function(instanceId) {
      if (instanceId === loadedApp)
        return;
      document.body.removeChild(document.getElementById('root'));
      el = document.createElement('div');
      el.id = 'root';
      document.body.appendChild(el);
      loadedApp = instanceId;
      var app = store.classrooms[classroom].currentState.instances[instanceId].app;
      requirejs(['/apps/' + app + '/' + store.apps[app].client], function(appModule) {
        var params = {
          'device': 0
        };
        appModule.load(document.getElementById('root'), stm.action, store.classrooms[classroom].currentState.instances[instanceId].root, params);
      });
    };

    if (gup('classroom') && gup('instance')) {
      classroom = gup('classroom');
      loadApp(gup('instance'));
    }
    else {
      login.display(el, {
        'student': true,
        'store': store
      }, function (_classroom, _student) {
        classroom = _classroom;
        student = _student;
        document.body.removeChild(document.getElementById('root'));
        el = document.createElement('div');
        el.id = 'root';
        document.body.appendChild(el);
        store.classrooms[classroom].currentState.addObserver(function(newStore) {
          loadApp(newStore.userInstanceMapping[student]);
        });
      });
    }
  });
});
