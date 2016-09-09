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

  var currentClassroom, appWs;
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
    } else if (gup('mode') == 'student') {
      var teacherId = gup('teacher');
      var classroomId = gup('classroom');
      var activity = store.teachers[teacherId].activities[store.teachers[teacherId].classrooms[classroomId].currentActivity];
      var student = store.teachers[teacherId].classrooms[classroomId].students[gup('student')];
      var phase = student.currentPhase;
      var app = activity.phases[phase].app;

      var params = {
        'mode': 'student',
        'student': student.id
      };

      requirejs(['/apps/' + app + '/' + store.apps[app].client], function(appModule) {
        appModule.load(document.getElementById('root'), stm.action, store.teachers[teacherId].classrooms[classroomId].groups[gup('group')].states[phase], params);
      });
    } else {
      document.body.removeChild(document.getElementById('statusbar'));
      loginHelper.login(function(email, user) {
        store.addObserver(function(newStore, oldStore) {
          if (oldStore === null)
            m.mount(document.getElementById('root'), m.component(Root, {'store': newStore, 'email': email, 'user': user}));
          else {
            if (typeof currentClassroom !== 'undefined' && (
                 newStore.teachers[currentClassroom.teacherId].classrooms[currentClassroom.classroomId].students[currentClassroom.studentId].currentPhase !== oldStore.teachers[currentClassroom.teacherId].classrooms[currentClassroom.classroomId].students[currentClassroom.studentId].currentPhase
              || newStore.teachers[currentClassroom.teacherId].classrooms[currentClassroom.classroomId].studentGroupMapping[currentClassroom.studentId] !== oldStore.teachers[currentClassroom.teacherId].classrooms[currentClassroom.classroomId].studentGroupMapping[currentClassroom.studentId]
            ))
                {
                  console.log('redraw!');
                  m.render(root, m.component(Root, {'store': newStore, 'email': email, 'user': user}));
                  m.redraw(true);
                }
          }
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
      else if (classrooms.length === 1) {
        currentClassroom = classrooms[0];
        return m.component(Classroom, _.extend({'store': store}, classrooms[0]));
      }
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
      else if (typeof args.groupId === 'undefined')
        return m('.waiting-for-teacher', "Waiting for your teacher to add you to a group...");
      else {
        var phase = student.currentPhase;
        var orderedPhases = _.values(activities[classroom.currentActivity].phases).sort(function(a, b) { return a.order - b.order});
        var currentPhaseIndex;
        for (var i = 0; i < orderedPhases.length; i++)
          if (orderedPhases[i].id === phase)
            currentPhaseIndex = i;
        return m('div.app-frame',
          m('div.phase-controls',
            m('div.arrow.arrow-left', {
              'style': (student.currentPhase === orderedPhases[0].id ? 'opacity: 0.5; pointer-events: none;' : ''),
              'onclick': function(e) {
                student.sendAction('update-student', {'currentPhase': orderedPhases[currentPhaseIndex - 1].id});
              }
            }, m.trust('&nbsp;')),
              orderedPhases.map(function(phase) {
                return m('div.phase-marker' + (phase.id === student.currentPhase ? '.active-phase' : ''), {
                  'onclick': function(e) {
                    student.sendAction('update-student', {'currentPhase': phase.id})
                  }
                }, m.trust("&nbsp;"));
            }),
            m('div.arrow.arrow-right', {
              'style': (student.currentPhase === orderedPhases[orderedPhases.length - 1 ].id ? 'opacity: 0.5; pointer-events: none;' : ''),
              'onclick': function(e) {
                student.sendAction('update-student', {'currentPhase': orderedPhases[currentPhaseIndex + 1].id});
              }
            }, m.trust('&nbsp;'))
          ),
          m('iframe.app-frame', {
            'src': 'client?mode=student&teacher=' + args.teacherId + '&classroom=' + args.classroomId + '&group=' + args.groupId + '&student=' + args.studentId
          })
        );
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
