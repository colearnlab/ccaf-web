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

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', 'cookies', 'modal', 'configurationActions', 'clientUtil', 'underscore'], function(exports, checkerboard, m, autoconnect, login, cookies, modal, configurationActions, clientUtil, _) {
  var wsAddress = 'wss://' + window.location.hostname;
  var stm = new checkerboard.STM(wsAddress);

  var gup = clientUtil.gup;

  var teacherId = gup('teacher');
  var classroomId = gup('classroom');
  var studentGroupMapping;

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

    var oldProjections;
    store.teachers[teacherId].classrooms[classroomId].addObserver(function(newClassroom, oldClassroom) {
      studentGroupMapping = newClassroom.studentGroupMapping;
      var projections = _.values(newClassroom.students)
        .filter(function(student) {
          return newClassroom.currentActivity !== null && student.projected;
        })
        .map(function(student) {
          return {'id': student.id, 'group': studentGroupMapping[student.id]};
        });

      if (JSON.stringify(projections) != JSON.stringify(oldProjections)) {
        m.render(document.getElementById('root'), m.component(panelComponent, projections));
        oldProjections = projections;
      }
    });
  });



  var panelComponent = {
    'view': function(ctrl, projections) {
      var numTiles = projections.length;
      var tileClass = '.tile' + numTiles;

      if (numTiles === 0)
        modal.display("Projecting", {dismissable:false});
      else
        modal.close();

      return m('div.panelHolder', {
        'style': 'column-count: ' + (numTiles < 4 ? numTiles : numTiles / 2)
      }, projections.map(function(projection) {
        return m('div.appPanel' + tileClass,
          m('iframe', {
            'key': projection.id,
            'src': 'client?mode=student&teacher=' + teacherId + '&classroom=' + classroomId + '&group=' + projection.group + '&student=' + projection.id
          })
        );
      }));
    }
  };
});
