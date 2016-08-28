// this snippet configures the location of requirejs modules. every main module
// must have this snippet, so this prevents copy and paste
{{> rjsConfig}}

// prevent collisions in electron.
module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'underscore', 'pinLock', 'autoconnect', 'configurationActions'], function(exports, checkerboard, m, _, pinLock, autoconnect, configurationActions) {
  var wsAddress = 'wss://' + window.location.host;
  var stm = new checkerboard.STM(wsAddress);

  // autoconnect displays a modal and reconnects when the connection is dropped.
  autoconnect.monitor(stm.ws);

  stm.init(function(store) {
    // the init function ensures that the store is properly formed and is not missing anything.
    configurationActions.load(stm);

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

    var el = document.getElementById('root');
    var callback = function() {
      m.mount(el, m.component(component, store));
    }

    if (store.config.passcode !== "" || store.config.passcode)
      pinLock.lock(store.config.passcode, el, callback);
    else
      callback();

    store.addObserver(observer);
  });

  var component = {
    'controller': function(args) {
      return {
        'cur': m.prop("Server"),
        'tabs': ["Server", "Security", "Networking"]
      };
    },
    'view': function(ctrl, store) {
      return m('.container',
        m('h1', "Settings"),
        m('.row',
          m('.col-xs-3.col-sm-3.col-md-3',
            m('ul.nav.nav-pills.nav-stacked',
              ctrl.tabs.map(function(text, i) {
                return m('li' + (ctrl.cur() === text ? '.active' : ''),
                  m('a', {
                    'onclick': ctrl.cur.bind(null, text)
                  }, text)
                );
              })
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
});
