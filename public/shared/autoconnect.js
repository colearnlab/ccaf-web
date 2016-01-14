define('autoconnect', ['exports', 'modal'], function(exports, modal) { 
  exports.monitor = function(ws) {
    var attemptReconnect = function() {
      modal.display('Disconnected. Trying to reconnect...', {'dismissable': false});
      var tmp = new WebSocket(ws.url);
      tmp.onopen = function() {
        location.reload();
      }
      tmp.onerror = attemptReconnect;
    };
    
    ws.addEventListener('close', attemptReconnect);
  };
});