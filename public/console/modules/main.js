/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'login', 'modal', 'configurationActions', './stateVisualizer', 'pinLock'], function(exports, checkerboard, m, autoconnect, login, modal, configurationActions, stateVisualizer, pinLock) {
  var wsAddress = 'wss://' + window.location.host;
  var stm = new checkerboard.STM(wsAddress);

  autoconnect.monitor(stm.ws);

  document.body.addEventListener('mousewheel', function(e) {
    return e.preventDefault(), false;
  });

  document.body.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'INPUT')
      return e.preventDefault(), false;
  });

  stm.init(function(store) {
    // get base element to mount to
    var root = document.getElementById('root');

    // load actions from shared source and initialize
    configurationActions.load(stm);
    store.sendAction('init');
    store.addObserver(function(){});

    if (parseInt(store.config.passcode) >= 0)
      pinLock.lock(store.config.passcode, root, start);
    else
      start();

    function start() {
      login.display(root, {
          'student': false,
          'store': store
        }, function(classroom) {
          var isEditing = true;
          m.mount(document.getElementById('edit-toggle-holder'), m.component(EditToggle, {'root': root, 'store': store, 'classroom': classroom, 'currentState': store.classrooms[classroom].currentState}));
          stateVisualizer.display(root, store, classroom, store.classrooms[classroom].currentState, false);
      });
    }
  });

  var EditToggle = {
    'controller': function(args) {
      return {
        'isEditing': false
      };
    },
    'view': function(ctrl, args) {
      return m('div.edit-toggle',
        m('div.edit-toggle-edit' + (ctrl.isEditing ? '.edit-toggle-active' : ''), {
          'onclick': function(e) {
            if (!ctrl.isEditing) {
              ctrl.isEditing = true;
              stateVisualizer.display(args.root, args.store, args.classroom, args.currentState, true);
            }
          }
        }, "Edit"),
        m('div.edit-toggle-live' + (!ctrl.isEditing ? '.edit-toggle-active' : ''), {
          'onclick': function(e) {
            if (ctrl.isEditing) {
              ctrl.isEditing = false;
              stateVisualizer.display(args.root, args.store, args.classroom, args.currentState, false);
            }
          }
        }, "Live")
      );
    }
  };
});
