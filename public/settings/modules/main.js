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

define('main', ['exports', 'checkerboard', 'mithril', 'underscore', 'clientUtil'], function(exports, checkerboard, m, _, clientUtil) {	 
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
      
      stm.action('setPasscode')
        .onReceive(function(passcode) {
          if (!isNaN(passcode) && isFinite(passcode))
            this.passcode = passcode;
          else
            this.passcode = null;
        });
        
      stm.action('setProperty')
        .onReceive(function(prop, val) {
          this[prop] = val;
        });
        
      stm.action
    
    store.sendAction('init');
        
    m.redraw.strategy('all');
    var classroomObserver = function(newValue, oldValue) {
      m.redraw(true);
    };
      m.mount(document.getElementById('navs'), m.component(store.config.passcode !== "" && store.config.passcode !== null ? lock : component, store));
  });
  
  var lock = {
    'controller': function(args) {
      return {
      
      };
    },
    'view': function(ctrl, store) {
      return m('.container',
        m('.row',
          m('.col-xs-4.col-xs-offset-4.col-sm-4.col-sm-offset-4.col-md-4.col-md-offset-4',
            m('.panel.panel-default', 
              m('.panel-heading', "Enter passcode"),
              m('panel-body',
                m('.form-group', {'style': 'width: 80%; margin: 0 auto; margin-top: 1em'},
                  m('input.form-control#passcode[type=\'password\']')
                ),
                [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [null, "0", null]].map(function(row, i) {
                  return m((i === 3 ? 'div' : '.btn-group'), {'style': 'margin: 0 auto; width: 80%; left: 10%; margin-top: 1em'},
                    row.map(function(key) {
                      return m('button.btn.btn-default', {
                        'style': 'width: 33%; ' + (key === null ? 'visibility: hidden' : ''),
                        'onclick': function() {
                          var passcode = document.getElementById('passcode');
                          passcode.value += key;
                          if (passcode.value.length === 4) {
                            if (passcode.value == store.config.passcode)
                              m.mount(document.getElementById('navs'), m.component(component, store));
                            else
                              passcode.value = "";
                          }
                        }
                      }, key);
                    })
                  );
                }), m.trust("&nbsp;")
              )
            )
          )
        )
      );
    }
  };
  
  var component = {
    'controller': function(args) {
      return {
        'cur': m.prop("Students"),
        'tabs': ["Security", "Students"]
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
  
  var tmpPasscode;
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
            'value': typeof tmpPasscode !== 'undefined' ? tmpPasscode : store.config.passcode,
            'oninput': function(e) {
              document.getElementById('passcodeSave').innerHTML = "Save";
              tmpPasscode = e.target.value;
              document.getElementById('passcodeSave').disabled = e.target.value.toString().length > 0 && (isNaN(e.target.value) || !isFinite(e.target.value) || e.target.value.toString().length != 4);
            }
          }),
          m.trust("&nbsp"),
          m('button.btn.btn-default#passcodeSave', {
            'onclick': function(e) {
              store.config.sendAction('setPasscode', document.getElementById('passcode').value);
              console.log(e.target.value);
              e.target.innerHTML = "Saved &#10003;";
            }
          }, "Save")
        )
      );
      
    if (tab === 'Students')
      return m('.row',
        m('.col-xs-6.col-sm-6.col-md-6', {'style': 'padding: 0'},
          m('.panel.panel-default', {'style': 'border-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0'},
            m('.panel-heading',
              m.trust("Classrooms&nbsp;"),
              m('button.btn.btn-default.btn-xs', {
                'onclick': function() {
                  store.classrooms.sendAction('setProperty', Math.max.apply(null, _.keys(store.classrooms).map(function(val) { return val.toString() })) + 1, {'users': {}, 'configuration': {'apps': {}, 'users': {}}, 'name': 'New classroom'});
                  m.redraw(true);
                }
              }, "+")),
            m('.panel-body', {'style': 'padding: 0; height: 60vh'}, 
              m('table.table.table-hover',
                m('tbody',
                  _.pairs(store.classrooms).map(function(kvPair) {
                    return m.component(classroomRow, _.extend(kvPair[1], {'id': kvPair[0]}));
                  })
                )
              )
            )
          )
        ),
        m('.col-xs-6.col-sm-6.col-md-6', {'style': 'padding: 0'},
          m('.panel.panel-default', {'style': 'border-top-left-radius: 0; border-bottom-left-radius: 0'},
            m('.panel-heading', 
              m.trust("Students&nbsp;"),
              (activeClassroom > 0 ? m('button.btn.btn-default.btn-xs', {
              
              }, "+") : '')
            ),
            m('.panel-body', {'style': 'padding: 0; height: 60vh'}, 
              m('table.table.table-hover',
                m('tbody',
                  _.pairs((store.classrooms[activeClassroom] || {}).users).map(function(kvPair) {
                    return m.component(studentRow, _.extend(kvPair[1], {'id': kvPair[0]}));
                  })
                )
              )
            )
          )
        )
      );
  }
  
  var activeClassroom;
  var classroomRow = {
    'controller': function(args) {
      return {
        'active': m.prop(false),
        'edit': m.prop(false)
      };
    },
    'view': function(ctrl, args) {
      return m('tr', m('td', {
        'config': function(el) {
          el.active = ctrl.active;
        },
        'onclick': function(e) {
          if (!ctrl.active()) {
            var others = e.target.parentNode.parentNode.children;
            for (var i = 0; i < others.length; i++) {
              others[i].children[0].classList.remove('info');
              others[i].children[0].active(false);
            }
            e.target.classList.add('info');
            ctrl.active(true);
            activeClassroom = args.id;
          } else {
            ctrl.edit(true);
            m.redraw(true);
          }
        }
      }, !ctrl.edit() ? args.name :
        m('input.form-control.input-sm', {
          'value': args.name,
          'config': function(el) {
            el.focus();
          },
          'oninput': function(e) {
            args.sendAction('setProperty', 'name', e.target.value);
          },
          'onblur': function(e) {
            ctrl.edit(false);
            m.redraw(true);
          },
          'onkeydown': function(e) {
            if (e.keyCode === 13) {
              ctrl.edit(false);
              m.redraw(true);
            }
          }
        })
      ));
    }
  };
  
  var studentRow = {
    'controller': function(args) {
      return {
      
      };
    },
    'view': function(ctrl, args) {
      return m('tr', m('td', args.name));
    }
  };
});