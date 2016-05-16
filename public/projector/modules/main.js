/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', 'cookies', 'modal', 'configurationActions', 'interact'], function(exports, checkerboard, m, autoconnect, login, cookies, modal, configurationActions, interact) {
  /* jshint ignore:start */
  var wsAddress = 'ws://' + window.location.hostname + ':' + {{ws}};
  /* jshint ignore:end */  var stm = new checkerboard.STM(wsAddress);
  autoconnect.monitor(stm.ws);

  document.body.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  document.body.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  var loadApp;
  var panels;
  stm.init(function(store) {
    configurationActions.load(stm);
    store.sendAction('init');
    var el = document.getElementById('root');
    var classroom;
    store.addObserver(function(){});
    login.display(el, {
      'student': false,
      'store': store
    }, function(_classroom) {
      classroom = _classroom;

      panels = [
        {x:0, y:0, a:0, s:1}
      ];

      m.mount(el, m.component(panelComponent, {'panels': store.classrooms[classroom].projections}));

      store.classrooms[classroom].projections.addObserver(function(projections) {
        m.redraw(true);
        //m.mount(el, m.component(panelComponent, {'panels': projections}));
      });
    });

    var loadedApp;
    loadApp = function(instanceId) {
      if (instanceId === loadedApp)
        return;
      document.body.removeChild(document.getElementById('root'));
      el = document.createElement('div');
      el.id = 'root';
      document.body.appendChild(el);
      loadedApp = instanceId;
      var app = store.classrooms[classroom].currentState.instances[instanceId].app;
      requirejs(['/apps/' + app + '/' + store.apps[app].client], function(appModule) {
        var params = {
          'device': 0
        };
        appModule.load(document.getElementById('root'), stm.action, store.classrooms[classroom].currentState.instances[instanceId].root, params);
      });
    };
  });

  var panelComponent = {
    'controller': function(args) {

        interact('.appPanel')
          .draggable({
            'autoscroll': false,
            'onmove': function(event) {
              var target = event.target,
                x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
                y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy,
                a = (parseFloat(target.getAttribute('data-a')) || 0),
                s = (parseFloat(target.getAttribute('data-s')) || 1);

              args.panels[target.getAttribute('data-index')].sendAction('update-projection', x, y, a, s);
              //m.redraw(true);
            }
          })
          .gesturable({
            'onmove': function(event) {
              var target = event.target,
                x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
                y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy,
                a = (parseFloat(target.getAttribute('data-a')) || 0) + event.da,
                s = (parseFloat(target.getAttribute('data-s')) || 1) * (1 + event.ds);

              args.panels[target.getAttribute('data-index')].sendAction('update-projection', x, y, a, s);
              //m.redraw(true);
            }
          });
    },
    'view': function(ctrl, args) {
      return m('div', args.panels.map(function(panel, index) {
        return m('div.appPanel', {
          'data-index': index,
          'data-x': panel.x,
          'data-y': panel.y,
          'data-a': panel.a,
          'data-s': panel.s,
          'style': 'transform: translate(' + panel.x + 'px, ' + panel.y + 'px) rotate(' + panel.a + 'deg) scale(' + panel.s + ')'
        }, m.trust("&nbsp;"));
      }));
    }
  };

});
