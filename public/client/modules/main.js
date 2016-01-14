{{> rjsConfig}}

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', './cornerMenu', 'cookies', 'modal'], function(exports, checkerboard, m, autoconnect, login, cornerMenu, cookies, modal) {  
  var wsAddress = 'ws://' + window.location.hostname + ':' + {{ws}};
  var stm = new checkerboard.STM(wsAddress);
  autoconnect.monitor(stm.ws);
  
  document.body.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });
  
  document.body.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });
  
  var deviceObserver, loadApp;
  stm.init(function(store) {
    login.display(document.getElementById('root'), {
      'student': true,
      'store': store
    }, function(classroom, student) {
      modal.display("Welcome " + student);
    });
  });
});