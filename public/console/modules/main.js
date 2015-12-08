requirejs.config({
  'paths': {
    'interact': '/lib/interact',
    'mithril': '/lib/mithril',
    'checkerboard': '/lib/checkerboard',
    'cookies': '/shared/cookies',
    'clientUtil': '/shared/clientUtil',
    'underscore': '/lib/underscore'
  },
  'shim': {
    'underscore': {
      'exports': '_'
    }
  }
});

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'clientUtil', './selector', './playground'], function(exports, checkerboard, m, clientUtil, selector, playground) {  
  var wsAddress = 'ws://' + window.location.hostname + ':' + (clientUtil.parameter('port') || '1808');
  var stm = new checkerboard.STM(wsAddress);
  var selected, classroom = null, device;
  
  stm.init(function(store) {
    stm.action('set-identity')
      .onReceive(function(_classroom) {
        selected = true;
        classroom = _classroom;
        m.redraw();
        store.classrooms[classroom].addObserver(classroomObserver);
        m.mount(document.getElementById('navs'), m.component(playground, {'store': store, 'classroom': store.classrooms[classroom], 'configuration': store.classrooms[classroom].configuration}));
        window.addEventListener('resize', m.redraw);
        return false;
      });
      
    stm.action('init')
      .onReceive(function() {
        this.classrooms = this.classrooms || {};
        var classroom;
        for (c in this.classrooms) {
          classroom = this.classrooms[c];
          classroom.configuration = classroom.configuration || {};
          classroom.configuration.apps = classroom.configuration.apps || {};
          classroom.configuration.users = classroom.configuration.users || {};
          classroom.users = classroom.users || {};
        }
      });
  
    stm.action('create-app-instance')
      .onReceive(function(app, el) {
        var cur = this.classrooms[classroom];
        var i = -1, j = calculateName(app, cur.configuration.apps);
        while (++i in cur.configuration.apps);
          
        cur.configuration.apps[i] = new Instance(app, store.apps[app].title + ' ' + j, getCoords(el).x, getCoords(el).y);   
      });
    
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
  
  function calculateName(app, instances) {
    var j = 1;
    Object.keys(instances)
      .map(function(p) { return instances[p]; })
      .forEach(function(instance) { 
        if (instance.app === app) {
          var num;
          if (parseInt(instance.title[instance.title.length - 1]) !== NaN) {
            if (parseInt(instance.title[instance.title.length - 2]) !== NaN)
              num = parseInt(instance.title.slice(instance.title.length - 2));
            else
              num = parseInt(instance.title.slice(instance.title.length - 1));
          
            if (num && num >= j)
              j = num + 1;
          }
        }
      });
      
    return j;
  }
  
  function getCoords(el) {
    var overhead = document.getElementById('overhead');
    return {
      'x': el.getAttribute('data-x') / overhead.offsetWidth,
      'y': el.getAttribute('data-y') / overhead.offsetHeight
    };
  }
  
  function Instance(app, title, x, y) {
    this.app = app;
    this.title = title;
    this.x = x;
    this.y = y;
  }
  
  function User(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
  }
});