{{> rjsConfig}}

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'clientUtil', './selector', './playground'], function(exports, checkerboard, m, clientUtil, selector, playground) {  
  var wsAddress = 'ws://' + window.location.hostname + ':' + (clientUtil.parameter('port') || '1808');
  var stm = new checkerboard.STM(wsAddress);
  var selected, classroom = null, device;
  
  stm.init(function(store) {

    
    stm.action('create-user-instance')
      .onReceive(function(user, el) {
        var cur = this.classrooms[classroom];
        var i = -1;
        while (++i in cur.configuration.users);
          
        cur.configuration.users[i] = new User(user, getCoords(el).x, getCoords(el).y);   
      });
      
    stm.action('set-coords')
      .onReceive(function(el) {
        this.x = getCoords(el).x;
        this.y = getCoords(el).y;
      });
      
    stm.action('delete-app-instance')
      .onReceive(function(id) {
        delete this[id];
      });
      
    stm.action('delete-user-instance')
      .onReceive(function(id) {
        delete this[id];
      });
      
    stm.action('assign-user-instance')
      .onReceive(function(appInstanceId) {
        this.appInstanceId = appInstanceId;
      });
    
    store.sendAction('init');
    
    m.mount(document.getElementById('navs'), m.component(selector, store));
    
    m.redraw.strategy('all');
    var classroomObserver = function(newValue, oldValue) {
      m.redraw(true);
    };
  });
});