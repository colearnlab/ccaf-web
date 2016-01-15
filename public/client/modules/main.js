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
    store.sendAction('init');
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
        'state': m.prop(0),
        'selectedApp': m.prop(null),
        'instanceTitle': m.prop(null)
      };
    },
    'view': function(ctrl, args) {
      var store = args.store;
      var classroom = store.classrooms[args.classroom];
      var apps = store.apps;
      var student = args.student;
      var contents;
      if (ctrl.state() === 0)
        contents = [
          m('.alert.alert-info', "Howdy ", m('strong', classroom.users[student].name), "! Pick a room or create your own. ", m('small', {'onclick': function() { location.reload() }}, m('a', "(That's not me)"))),
          m('.list-group',
            _.keys(classroom.configuration.instances).map(function(instance) {
              instance = classroom.configuration.instances[instance];
              return m('a.list-group-item',
                m('h4.list-group-item-heading', instance.title || apps[instance.app].title),
                m('.list-group-item-text', "With ...")
              );
            }),
            m('a.list-group-item', {
              'onclick': function() {
                ctrl.state(1);
              }
            }, m('strong', "Create a room "), m('span.hoverlight.glyphicon.glyphicon-chevron-right'))
          )
        ];
      else if (ctrl.state() === 1)
        contents = [
          m('.panel.panel-default',
            m('.panel-heading', m('span.glyphicon.glyphicon-chevron-left.hoverlight', {'onclick': function() { ctrl.state(0); }}), " Create a room: select an app"),
            m('.panel-body',
              m('#apps',
                _.keys(store.apps).map(function(app) {
                  return m('.app',
                    m('img', {
                      'src': '/apps/' + app + '/' + store.apps[app].icon,
                      'onclick': function(e) {
                        ctrl.selectedApp(app);
                        ctrl.instanceTitle(classroom.users[student].name + "\'s " + store.apps[app].title);
                        ctrl.state(2);
                      }
                    }),
                    m('p', store.apps[app].title)
                  );
                })
              )
            )
          )
        ];
      else if (ctrl.state() === 2) 
        contents = [
          m('.panel.panel-default',
            m('.panel-heading', m('span.glyphicon.glyphicon-chevron-left.hoverlight', {'onclick': function() { ctrl.state(1); }}), " Create a room: create a name"),
            m('.panel-body',
              m('#instanceName',
                m('.selectedApp',
                  m('img', {'src': '/apps/' + ctrl.selectedApp() + '/' + store.apps[ctrl.selectedApp()].icon}),
                  m('p', store.apps[ctrl.selectedApp()].title)
                ),
                m('.input-group',
                  m('input.form-control.input-lg', {
                    'value': ctrl.instanceTitle(),
                    'oninput': m.withAttr('value', ctrl.instanceTitle)
                  }),
                  m('span.input-group-btn',
                    m('button.btn.btn-primary.btn-lg', {
                      'onclick': function() {
                        var rval = {};
                        store.sendAction('create-app-instance', args.classroom, ctrl.selectedApp(), ctrl.instanceTitle(), rval);
                        store.sendAction('associate-user-to-instance', args.classroom, args.student, rval.instanceId);
                      }
                    }, "Go!")
                  )
                )
              )
            )
          )
        ];
        
      return m('.container',
          m('.row',
            m('br'),
            m('.col-xs-10.col-xs-offset-1.col-sm-6-col-sm-offset-3.col-md-4.col-md-offset-4', contents)
          )
        );
    }
  };
});