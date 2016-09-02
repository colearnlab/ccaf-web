/* Main client module
 * This is the main module for the CCAF client application. The client application
 * is how students will use applications. It can be run in the browser, in the electron-browser
 * app (which has some extra external logic to handle server discovery), or projected
 * (ie via iframe). The client module first identifies with a student (via GUI login)
 * or a specific instance (via URL parameters).
 * - GUI login
 *    Loads the instance pointed to by the user-instance mapping. If there is no
 *    instance, it shows a blank screen. It automatically unloads/loads instances
 *    when the mapping is changed.
 * - URL login
 *    Used when instances are loaded via iframe to be shown as projector panels.
 *    Loads the specified instance. If the instance is deleted, it shows a blank screen.
 *    However, as projections are also removed when instances are removed, this is
 *    a fallback and shouldn't ever be seen by the end-user.
 */

/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

// Ensures that RequireJS plays nicely with electron-browser.
module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'configurationActions'], function(exports, checkerboard, m, autoconnect, configurationActions) {
  var wsAddress = 'wss://' + window.location.host;
  var stm = new checkerboard.STM(wsAddress);

  // autoconnect will detect a WebSocket disconnect, show a modal and try to reconnect.
  autoconnect.monitor(stm.ws);

  // Prevent multitouch zoom in Google Chrome.
  document.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  // Prevent back/forward gestures in Google Chrome.
  document.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  stm.init(function(store) {
    store.addObserver(function(){});
    configurationActions.load(stm);

    /* --- Start of code run on initialization --- */
    if (gup('mode') == 'initialStateSetup') {
      var teacherId = gup('teacher');
      var activityId = gup('activity');
      var phaseId = gup('phase');

      var phase = store.teachers[teacherId].activities[activityId].phases[phaseId];

      var app = phase.app;
      var initialState = phase.initialState;

      requirejs(['/apps/' + app + '/' + store.apps[app].client], function(appModule) {
        var mode = 'student';
        var params = {
          'mode': 'projector'
        };

        // The load function takes a root element, an action creator, the root store and the future paramters object.
        appModule.load(reRoot(), stm.action, initialState, params);
      });
    }

  });

  /* --- support functions --- */

  /* [g]et [u]RL [p]arameters, or return null if there are none.
   * http://stackoverflow.com/a/979997
   */
  function gup( name, url ) {
    if (!url) url = location.href;
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( url );
    return results === null ? null : results[1];
  }

  /* The reRoot function prunes the root element which all applications attach
   * themselves to.
   */
  function reRoot() {
    if (document.getElementById('root'))
      document.body.removeChild(document.getElementById('root'));

    var el = document.createElement('div');
    el.id = 'root';
    document.body.appendChild(el);
    return el;
  }

  /* --- playback helpers --- */

  /* WebSocketShell: a dummy WebSocket object that we can trigger arbitrary messages */
  function WebSocketShell () {
    this.messageHandlers = [];
  }

  WebSocketShell.prototype = Object.create(WebSocket.prototype);
  WebSocketShell.prototype.addEventListener = function(channel, callback) {
    if (channel === 'message')
      this.messageHandlers.push(callback);
  };
  WebSocketShell.prototype.send = function() {  /*wss.messageHandlers[0](makeFrame('set-state', {data:{}}));*/ };
  WebSocketShell.prototype.sendFrame = function(channel, message) {
    this.messageHandlers.forEach(function(handler) {
      handler({data: JSON.stringify({channel: channel, message: message})});
    });
  };
});
