/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', 'modal', 'configurationActions', './stateVisualizer', 'pinLock'], function(exports, checkerboard, m, autoconnect, login, modal, configurationActions, stateVisualizer, pinLock) {

  /* jshint ignore:start */
  var wsAddress = 'ws://' + window.location.hostname + ':' + {{ws}};
  /* jshint ignore:end */
  var stm = new checkerboard.STM(wsAddress);

  autoconnect.monitor(stm.ws);

  document.body.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  document.body.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  stm.init(function(store) {
    // get base element to mount to
    var root = document.getElementById('root');

    // load actions from shared source and initialize
    configurationActions.load(stm);
    store.sendAction('init');
    store.addObserver(function(){});

    if (parseInt(store.config.passcode) >= 0)
      pinLock.lock(store.config.passcode, root, start);
    else
      start();

    function start() {
      login.display(root, {
          'student': false,
          'store': store
        }, function(classroom) {
          stateVisualizer.display(root, store, classroom, store.classrooms[classroom].currentState);
      });
    }
  });
});
