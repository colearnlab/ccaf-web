/* Main client module
 * This is the main module for the CCAF client application. The client application
 * is how students will use applications. It can be run in the browser, in the electron-browser
 * app (which has some extra external logic to handle server discovery), or projected
 * (ie via iframe). The client module first identifies with a student (via GUI login)
 * or a specific instance (via URL parameters).
 */

/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

// Ensures that RequireJS plays nicely with electron-browser.
module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'configurationActions', 'loginHelper'], function(exports, checkerboard, m, autoconnect, configurationActions, loginHelper) {
  var wsAddress = 'wss://' + window.location.host;
  var stm = new checkerboard.STM(wsAddress);

  // autoconnect will detect a WebSocket disconnect, show a modal and try to reconnect.
  autoconnect.monitor(stm.ws);

  // Prevent multitouch zoom in Google Chrome.
  document.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  // Prevent back/forward gestures in Google Chrome.
  document.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  stm.init(function(store) {
    store.addObserver(function(){});
    configurationActions.load(stm);

    /* --- Start of code run on initialization --- */
    if (gup('mode') == 'initialStateSetup') {
      var teacherId = gup('teacher');
      var activityId = gup('activity');
      var phaseId = gup('phase');

      var phase = store.teachers[teacherId].activities[activityId].phases[phaseId];

      var app = phase.app;
      var initialState = phase.initialState;

      requirejs(['/apps/' + app + '/' + store.apps[app].client], function(appModule) {
        var params = {
          'mode': 'projector'
        };

        // The load function takes a root element, an action creator, the root store and the future paramters object.
        appModule.load(reRoot(), stm.action, initialState, params);
      });
    } else {
      loginHelper.login(function(email, user) {
        store.addObserver(function(newStore, oldStore) {
          if (oldStore === null)
            m.render(document.getElementById('root'), m.component(Root, {'store': newStore, 'email': email, 'user': user}));

          // redraw conditions:
        });
      });
    }
  });

  var Root = {
    'view': function(__, args) {
      var store = args.store;
      var email = args.email;
      var user = args.user;
      var classrooms = [];
      _.values(store.teachers).forEach(function(teacher) {
        _.values(teacher.classrooms).forEach(function(classroom) {
          _.values(classroom.students).forEach(function(student) {
            if (student.email === email) {
              classrooms.push({'teacherId': teacher.id, 'classroomId': classroom.id, 'groupId': classroom.studentGroupMapping[student.id], 'studentId': student.id});
              student.sendAction('update-student', {'name': user.displayName});
            }
          });
        });
      });

      if (classrooms.length === 0)
        return m.component(NoClassroom);
      else if (classrooms.length === 1)
        return m.component(Classroom, _.extend({'store': store}, classrooms[0]));
    }
  }

  var NoClassroom = {
    'view': function(__, args) {
      return m('div', "You haven't yet been added to a classroom. Ask your teacher to add you, and make sure that you are logging in with the email that they used to add you.");
    }
  }

  var Classroom = {
    'view': function(__, args) {
      var teacher = args.store.teachers[args.teacherId];
      var activities = teacher.activities;
      var classroom = teacher.classrooms[args.classroomId];
      var group = classroom.groups[args.groupId];
      var student = classroom.students[args.studentId];

      if (typeof classroom.currentActivity === 'undefined')
        return m('.waiting-for-teacher', "Waiting for your teacher to launch an activity...");
      else {
        var phase = student.currentPhase;
        return m('div', {
          'key': args.groupId + '.' + phase,
          'config': function(el) {
              var appStm = new checkerboard.STM(wsAddress);
              var params = {
                'mode': student,
                'student': args.studentId
              };
              var app = activities[classroom.currentActivity].phases[phase].app;
              appStm.init(function(appStore) {
                requirejs(['/apps/' + app + '/' + appStore.apps[app].client], function(appModule) {
                  appModule.load(el, appStm.action, appStore.teachers[args.teacherId].classrooms[args.classroomId].groups[args.groupId].states[phase], params);
                });
              });
          }
        });
      }
    }
  };

  var ClassroomSelect = {
    'view': function(__, args) {

    }
  }

  /* --- support functions --- */

  /* [g]et [u]RL [p]arameters, or return null if there are none.
   * http://stackoverflow.com/a/979997
   */
  function gup( name, url ) {
    if (!url) url = location.href;
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( url );
    return results === null ? null : results[1];
  }

  /* The reRoot function prunes the root element which all applications attach
   * themselves to.
   */
  function reRoot() {
    if (document.getElementById('root'))
      document.body.removeChild(document.getElementById('root'));

    var el = document.createElement('div');
    el.id = 'root';
    document.body.appendChild(el);
    return el;
  }

  /* --- playback helpers --- */

  /* WebSocketShell: a dummy WebSocket object that we can trigger arbitrary messages */
  function WebSocketShell () {
    this.messageHandlers = [];
  }

  WebSocketShell.prototype = Object.create(WebSocket.prototype);
  WebSocketShell.prototype.addEventListener = function(channel, callback) {
    if (channel === 'message')
      this.messageHandlers.push(callback);
  };
  WebSocketShell.prototype.send = function() {  /*wss.messageHandlers[0](makeFrame('set-state', {data:{}}));*/ };
  WebSocketShell.prototype.sendFrame = function(channel, message) {
    this.messageHandlers.forEach(function(handler) {
      handler({data: JSON.stringify({channel: channel, message: message})});
    });
  };
});
