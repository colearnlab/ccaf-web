/* autoconnect.js: Monitors a browser-side WebSocket connect. If the connection
 * fails, it throws up a modal showing that the connection was disrupted and tries
 * to reconnect. If the WebSocket connection is recovered, then it reloads the page.
 */

define('autoconnect', ['exports', 'modal'], function(exports, modal) {
  exports.monitor = function(ws) {
    var attemptReconnect = function() {
      modal.display('Disconnected. Trying to reconnect...', {'dismissable': false});
      var tmp = new WebSocket(ws.url);
      tmp.onopen = function() {
        location.reload();
      };
      tmp.onerror = attemptReconnect;
    };

    ws.addEventListener('close', attemptReconnect);
  };
});
