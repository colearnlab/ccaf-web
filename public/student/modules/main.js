define("main", ["exports", "mithril", "synchronizedStateClient"], function(exports, m, synchronizedStateClient) {
  var wsAddress = 'ws://' + window.location.host;

  // Prevent multitouch zoom in Google Chrome.
  document.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  // Prevent back/forward gestures in Google Chrome.
  document.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  var Shell = {
    controller: function() {
      return {

      };
    },
    view: function() {
      return m("#main");
    }
  };
});
