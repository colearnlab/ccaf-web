/* The projector is a simple module that allows the teacher to manipulate multiple
 * "views" into different instances. These manipulations are also shared across
 * different screens the projector is opened on. Each classroom has an array of
 * instances being projected, along with x, y, z, [s]cale and [a]ngle information.
 * From the console, the teacher can toggle how each instance is projected.
 */

/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', 'cookies', 'modal', 'configurationActions', 'interact'], function(exports, checkerboard, m, autoconnect, login, cookies, modal, configurationActions, interact) {
  /* jshint ignore:start */
  var wsAddress = 'wss://' + window.location.hostname;
  /* jshint ignore:end */
  var stm = new checkerboard.STM(wsAddress);

  // autoconnect will detect a WebSocket disconnect, show a modal and try to reconnect.
  autoconnect.monitor(stm.ws);

  // Prevent multitouch zoom in Google Chrome.
  document.body.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  // Prevent back/forward gestures in Google Chrome.
  document.body.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  stm.init(function(store) {
    configurationActions.load(stm);
    store.sendAction('init');

    store.addObserver(function(){});

    var root = document.getElementById('root');
    login.display(root, {'type': 'classroom', 'store': store}, function(classroom) {
      m.mount(root, m.component(panelComponent, {'classroom': classroom, 'classroomName': store.classrooms[classroom].name, 'panels': store.classrooms[classroom].projections}));
      store.classrooms[classroom].projections.addObserver(function(classroom, oldClassroom) {
        m.redraw(true);
      });
    });
  });

  var panelComponent = {
    'view': function(ctrl, args) {
      var panels = _.values(args.panels);
      var numTiles = panels.length;
      var tileClass = '.tile' + numTiles;

      if (numTiles === 0)
        modal.display("Projecting " + args.classroomName, {dismissable:false});
      else
        modal.close();

      return m('div.panelHolder', {
        'style': 'column-count: ' + (numTiles < 4 ? numTiles : numTiles / 2)
      }, panels.map(function(panel) {
        return m('div.appPanel' + tileClass,
          m('iframe', {
            'src': 'client?classroom=' + args.classroom + '&instance=' + panel.instanceId
          })
        );
      }));
    }
  };
});
