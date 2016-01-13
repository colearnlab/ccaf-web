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

define('main', ['exports', 'checkerboard', 'mithril', 'clientUtil'], function(exports, checkerboard, m, clientUtil) {	 
  var wsAddress = 'ws://' + window.location.hostname + ':' + (clientUtil.parameter('port') || '1808');
  var stm = new checkerboard.STM(wsAddress);
  var selected, classroom = null, device;
  
  stm.init(function(store) {
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
    
    store.sendAction('init');
        
    m.redraw.strategy('all');
    var classroomObserver = function(newValue, oldValue) {
      m.redraw(true);
    };
    
    m.mount(document.getElementById('navs'), m.component(component, store));
  });
  
  var component = {
    'controller': function(args) {
      return {
        'cur': m.prop(),
        'tabs': ["Security", "Classrooms", "Students"]
      };
    },
    'view': function(ctrl, store) {
      return m('.container',
        m('h1', "Settings"),
        m('.row',
          m('.col-xs-3.col-sm-3.col-md-3',
            m('ul.nav.nav-pills.nav-stacked',
              ctrl.tabs.map(function(text, i) { return m('li' + (ctrl.cur() === text ? '.active' : ''), m('a', {'onclick': ctrl.cur.bind(null, text)}, text)); })
            )
          ),
          m('.col-xs-9.col-sm-9.col-md-9',
            getPanel(ctrl.cur(), store)
          )
        )
      );
    }
  };
  
  function getPanel(tab, store) {
    if (tab === 'Security')
      return m('.form-inline',
        m('.form-group',
          m('p', "Enter a four-digit numeric pin code that needs to be entered whenever a teacher or admin console is accessed, or leave blank for no passcode."),
          m('input.form-control#passcode[type=\'number\']', {
            'min': 1000,
            'max': 9999,
            'style': 'width: 12em',
            'placeholder': "No passcode",
            'oninput': function(e) {
              document.getElementById('passcodeSave').disabled = !(e.target.value.toString().length === 0) && isNaN(e.target.value) || !isFinite(e.target.value) || e.target.value.toString().length != 4;
            }
          }),
          m.trust("&nbsp"),
          m('button.btn.btn-default#passcodeSave', "Save")
        )
      );
  }
});