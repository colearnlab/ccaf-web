{{> rjsConfig}}

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'underscore', 'pinLock', 'autoconnect'], function(exports, checkerboard, m, _, pinLock, autoconnect) {	 
  var wsAddress = 'ws://' + window.location.hostname + ':' + {{ws}};
  var stm = new checkerboard.STM(wsAddress);
  autoconnect.monitor(stm.ws);
  
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
        
      stm.action('deleteProperty')
        .onReceive(function(prop) {
          delete this[prop];
        });
    
    store.sendAction('init');
        
    m.redraw.strategy('all');
    var observer = function(newValue, oldValue) {
      m.redraw(true);
    };
    
    var navs = document.getElementById('navs');
    var callback = function() {
      m.mount(navs, m.component(component, store));
    }
    
    if (store.config.passcode !== "" || store.config.passcode)
      pinLock.lock(store.config.passcode, navs, callback);
    else
      callback();
      
    store.addObserver(observer);
  });
  
  var component = {
    'controller': function(args) {
      return {
        'cur': m.prop("Server"),
        'tabs': ["Server", "Security", "Students", "Networking"]
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
  
  var tmpConfig;
  var ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  var portRegex = /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/;
  function getPanel(tab, store) {   
    if (tab === "Server")
      return m('div',
        m('.alert.alert-danger', "If the server is stopped, you will have to restart it from the physical device location."),
        m('.alert.alert-warning', "If the server is stopped or restarted, all users will be disconnected."),
        m('button.btn.btn-warning', {
          'onclick': function(e) {
            stm.ws.send(JSON.stringify({'channel': 'restart'}));
            location.reload();
          }
        }, 'Restart'),
        m.trust("&nbsp;"),
        m('button.btn.btn-danger', {
          'onclick': function(e) {
            stm.ws.send(JSON.stringify({'channel': 'stop'}));
            location.href = "data:text/plain;charset=utf-8;base64,VGhlIENDQUYgc2VydmVyIGhhcyBiZWVuIHN0b3BwZWQuIFRvIHN0YXJ0IGl0IGFnYWluLCB5b3UgbXVzdCBtYW51YWxseSBsYXVuY2ggaXQgb24gdGhlIGRldmljZSBpdCBpcyBob3N0ZWQgb24u";
          }
        }, 'Stop')
      );
  
    if (tab === 'Security')
      return m('.form-inline',
        m('.form-group',
          m('.alert.alert-info', "Enter a four-digit numeric pin code that needs to be entered whenever a teacher or admin console is accessed, or leave blank for no passcode."),
          m('input.form-control#passcode[type=\'number\']', {
            'min': 1000,
            'max': 9999,
            'style': 'width: 12em',
            'placeholder': "No passcode",
            'value': tmpConfig && typeof tmpConfig.passcode !== 'undefined' ? tmpConfig.passcode : store.config.passcode,
            'oninput': function(e) {
              document.getElementById('passcodeSave').innerHTML = "Save";
              if (!tmpConfig) tmpConfig = {};
              tmpConfig.passcode = e.target.value.toString();
              document.getElementById('passcodeSave').disabled = e.target.value.length > 0 && (isNaN(e.target.value) || !isFinite(e.target.value) || e.target.value.toString().length != 4);
            }
          }),
          m.trust("&nbsp"),
          m('button.btn.btn-default#passcodeSave', {
            'onclick': function(e) {
              store.config.sendAction('setPasscode', document.getElementById('passcode').value);
              e.target.innerHTML = "Saved &#10003;";
            }
          }, "Save")
        )
      );
    
    if (tab === 'Students')
      return m('.row',
        m('.alert.alert-info', "Tap a classroom to view its students. Double-click or tap an entry to edit or delete it."),
        m('.col-xs-6.col-sm-6.col-md-6', {'style': 'padding: 0'},
          m('.panel.panel-default', {'style': 'border-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0'},
            m('.panel-heading',
              m.trust("Classrooms&nbsp;"),
              m('button.btn.btn-default.btn-xs', {
                'onclick': function() {
                  var id = 0;
                  if (_.keys(store.classrooms).length > 0)
                    id = Math.max.apply(null, _.keys(store.classrooms).map(function(val) { return val.toString() })) + 1;
                  store.classrooms.sendAction('setProperty', id, {'users': {}, 'configuration': {'apps': {}, 'users': {}}, 'name': 'New classroom'});
                  m.redraw(true);
                }
              }, "+")),
            m('.panel-body', {'style': 'padding: 0; height: 60vh; overflow: auto'}, 
              m('table.table.table-hover',
                m('tbody',
                  _.pairs(store.classrooms).map(function(kvPair) {
                    return m.component(classroomRow, _.extend(kvPair[1], {'id': kvPair[0], 'del': function() { store.classrooms.sendAction('deleteProperty', kvPair[0])} }));
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
              m('button.btn.btn-default.btn-xs', {
                'style': (activeClassroom >= 0 ? '' : 'visibility: hidden'),
                'onclick': function() {
                  var id = 0;
                  if (_.keys(store.classrooms[activeClassroom].users).length > 0)
                    id = Math.max.apply(null, _.keys(store.classrooms[activeClassroom].users).map(function(val) { return val.toString() })) + 1;
                  store.classrooms[activeClassroom].users.sendAction('setProperty', id, {'name': 'New student'});
                  m.redraw(true);
                }
              }, "+")
            ),
            m('.panel-body', {'style': 'padding: 0; height: 60vh;  overflow: auto'}, 
              m('table.table.table-hover',
                m('tbody',
                  _.pairs((store.classrooms[activeClassroom] || {}).users).map(function(kvPair) {
                    return m.component(studentRow, _.extend(kvPair[1], {'id': kvPair[0], 'del': function() { store.classrooms[activeClassroom].users.sendAction('deleteProperty', kvPair[0]); } }));
                  })
                )
              )
            )
          )
        )
      );
     
    if (tab === "Networking")
      return !tmpConfig || !tmpConfig.ports ? tmpConfig = _.mapObject(store.config, _.clone) : 0, m('div',
        m('.alert.alert-danger', "Warning: improperly changing these values may render the server inaccessible."),
        m('.alert.alert-warning', "The server will restart after these values are changed. Ensure that it is not being used before changing them."),
        m('.form-group',
          m('label', "Subnet mask"),
          m('input.form-control', {
            'value': typeof tmpConfig.subnet !== 'undefined' ? tmpConfig.subnet : store.config.subnet,
            'oninput': function(e) {
              tmpConfig.subnet = e.target.value;
            }
          })
        ),
        m('.form-group',
          m('label', "HTTP port"),
          m('input.form-control[type=\'number\']', {
            'value': tmpConfig.ports.http >= 0 ? tmpConfig.ports.http : store.config.ports.http,
            'oninput': function(e) {
              tmpConfig.ports.http = e.target.value;
            }
          })
        ),
        m('.form-group',
          m('label', "WebSocket port"),
          m('input.form-control[type=\'number\']', {
            'value': tmpConfig.ports.ws >= 0 ? tmpConfig.ports.ws : store.config.ports.ws,
            'oninput': function(e) {
              tmpConfig.ports.ws = e.target.value;
            }
          })
        ),
        m('.form-group',
          m('label', "UDP port"),
          m('input.form-control[type=\'number\']', {
            'value': tmpConfig.ports.udp >= 0 ? tmpConfig.ports.udp : store.config.ports.udp,
            'oninput': function(e) {
              tmpConfig.ports.udp = e.target.value;
            }
          })
        ),
        m('.form-group',
          m('button.btn.btn-default', {
            'onclick': function(e) {
              store.config.sendAction('setProperty', 'subnet', tmpConfig.subnet);
              store.config.ports.sendAction('setProperty', 'http', tmpConfig.ports.http);
              store.config.ports.sendAction('setProperty', 'ws', tmpConfig.ports.ws);
              store.config.ports.sendAction('setProperty', 'udp', tmpConfig.ports.udp);
              stm.ws.send(JSON.stringify({'channel': 'restart'}));
              location.reload();
            },
            'disabled': !(ipRegex.test(tmpConfig.subnet) && portRegex.test(tmpConfig.ports.udp) && portRegex.test(tmpConfig.ports.ws) && portRegex.test(tmpConfig.ports.http))
          }, "Save and restart")
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
      return m('tr' + (activeClassroom === args.id ? '.info' : ''), m('td.hover-activate', {
        'config': function(el) {
          el.active = ctrl.active;
        },
        'onclick': function(e) {
          if (!ctrl.active()) {
            var others = e.target.parentNode.parentNode.children;
            for (var i = 0; i < others.length; i++) {
              others[i].children[0].classList.remove('info');
              if (others[i].children[0].active) others[i].children[0].active(false);
            }
            e.target.classList.add('info');
            ctrl.active(true);
            activeClassroom = args.id;
          }
        },
        'ondblclick': function(e) {
          ctrl.edit(true);
          m.redraw(true);
        }
      }, !ctrl.edit() ? [args.name, m('span.glyphicon.glyphicon-remove.hover-hide.pull-right', {
        'onclick': function(e) {
          activeClassroom = undefined;
          args.del();
          m.redraw(true);
        }
        })] :
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
        'edit': m.prop(false)
      };
    },
    'view': function(ctrl, args) {
      return m('tr', m('td.hover-activate', {
        'ondblclick': function(e) {
          ctrl.edit(true);
        }
      }, !ctrl.edit() ? [args.name, m('span.glyphicon.glyphicon-remove.hover-hide.pull-right', {
        'onclick': function(e) {
          args.del();
        }
      })] :
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
});