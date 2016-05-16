/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', 'modal', 'configurationActions', './stateVisualizer'], function(exports, checkerboard, m, autoconnect, login, modal, configurationActions, stateVisualizer) {

  // connect to our websocket server (port spliced in by template processor
  /* jshint ignore:start */
  var wsAddress = 'ws://' + window.location.hostname + ':' + {{ws}};
  /* jshint ignore:end */
  var stm = new checkerboard.STM(wsAddress);

  // reload automatically if disconnected
  autoconnect.monitor(stm.ws);

  // the following functions prevent users from zooming in chrome via multitouch
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

    login.display(root, {
        'student': false,
        'store': store
      }, function(classroom) {
        store.addObserver(function(){});
        stateVisualizer.display(root, store, store.classrooms[classroom].currentState);
    });
  });
});
