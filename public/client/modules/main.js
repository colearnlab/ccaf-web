{{> rjsConfig}}

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', './cornerMenu', 'cookies', 'modal', 'configurationActions'], function(exports, checkerboard, m, autoconnect, login, cornerMenu, cookies, modal, configurationActions) {  
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
    configurationActions.load(stm);
    var el = document.getElementById('root');
    login.display(el, {
      'student': true,
      'store': store
    }, function(classroom, student) {
      document.body.classList.add('logged-in');
      if (true || store.classrooms[classroom].configuration.live)
        m.mount(el, m.component(appSelector, {'classroom': classroom, 'student': student, 'store': store}));
    });
  });
  
  var appSelector = {
    'controller': function(args) {
      return {
        'state': m.prop(0)
      };
    },
    'view': function(ctrl, args) {
      var store = args.store;
      var classroom = store.classrooms[args.classroom];
      var apps = store.apps;
      var student = args.student;
      if (ctrl.state() === 0)
        return m('.container',
          m('.row',
            m('br'),
            m('.col-xs-10.col-xs-offset-1.col-sm-6-col-sm-offset-3.col-md-4.col-md-offset-4',
              m('.alert.alert-info', "Howdy " + classroom.users[student].name + "! Pick a room or create your own."),
              m('.list-group',
                _.keys(classroom.configuration.instances).map(function(instance) {
                  return m('a.list-group-item',
                    m('.list-group-item-heading', instance.name || apps[instance.app].name),
                    m('.list-group-item-text', "With ...")
                  );
                }),
                m('a.list-group-item', {
                  'onclick': function() {
                    ctrl.state(1);
                  }
                }, m('strong', "Create a room"))
              )
            )
          )
        );
        
      return m('div');
    }
  };
});