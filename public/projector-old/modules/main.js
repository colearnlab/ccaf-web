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
  var wsAddress = 'ws://' + window.location.hostname + ':' + {{ws}};
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
    login.display(root, {'student': false, 'store': store}, function(classroom) {
      m.mount(root, m.component(panelComponent, {'classroom': classroom, 'panels': store.classrooms[classroom].projections}));
      store.classrooms[classroom].projections.addObserver(function(classroom, oldClassroom) {
        m.redraw(true);
      });
    });
  });

  /* Update the z-indexes of all the projections.
   */
  function updateZ(args, event) {
    // Record the largest z-index of all projections.
    var zIndex = 0;

    [].forEach.call(document.getElementsByClassName('appPanel'), function(panel) {
      // Mark if this z-index is largest so far.
      if (parseInt(panel.style.zIndex) > zIndex)
        zIndex = parseInt(panel.style.zIndex);
    });

    // Set the z-index of the touched panel to one greater than the current greatest.
    // The maximum z-index in most modern browsers is 2^31-1. By my calculations,
    // this method of keeping the most recently touched projection on top will last
    // ~70 years of continuous use. If this becomes an issue, you can find me in
    // the nursing home as I'll be 90 years old.
    args.panels[event.target.getAttribute('data-index')].sendAction('update-projection', void 0, void 0, void 0, void 0, zIndex + 1);
  }

  /* Update the x- and y-coordinates, the angle, and the scale. To do this, grab
   * the existing value, modify it according to the delta in the event, and
   * update the value in the store. Mithril and Checkerboard will handle the rest.
   * This method is used for both interact draggable and gesturable events. Draggable
   * events don't have a da and ds, so we substitute values that result in no change.
   */
  function updateCoords(args, event) {
    var target = event.target,
      x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
      y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy,
      a = (parseFloat(target.getAttribute('data-a')) || 0) + (event.da || 0),
      s = (parseFloat(target.getAttribute('data-s')) || 1) * (1 + (event.ds || 0));

    args.panels[target.getAttribute('data-index')].sendAction('update-projection', x, y, a, s);
  }

  var panelComponent = {
    'controller': function(args) {
        interact('.appPanel')
          .draggable({
            'onstart': updateZ.bind(null, args),
            'onmove': updateCoords.bind(null, args)
          })
          .gesturable({
            'onstart': updateZ.bind(null, args),
            'onmove': updateCoords.bind(null, args)
          });
    },
    'view': function(ctrl, args) {
      return m('div', _.pairs(args.panels).map(function(panel) {
        return m('div.appPanel', {
          'data-index': panel[0],
          'key': panel[1].instanceId,
          'data-x': panel[1].x,
          'data-y': panel[1].y,
          'data-a': panel[1].a,
          'data-s': panel[1].s,
          'style': 'transform: translate(' + panel[1].x + 'px, ' + panel[1].y + 'px) rotate(' + panel[1].a + 'deg) scale(' + panel[1].s + '); z-index: ' + panel[1].z
        },
          m('div.frameBlocker'),
          m('iframe', {
            'src': 'client?classroom=' + args.classroom + '&instance=' + panel[1].instanceId
          })
        );
      }));
    }
  };
});
