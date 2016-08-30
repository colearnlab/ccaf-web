/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'modal', 'configurationActions', './stateVisualizer', 'clientUtil', 'underscore'], function(exports, checkerboard, m, autoconnect, modal, configurationActions, stateVisualizer, clientUtil, _) {
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

    var email = clientUtil.gup('email');
    if (email === "")
      location.href = "/";

    function getTeacher() {
      for (var id in store.teachers) {
        if (email === store.teachers[id].email)
          return id;
      }
    }

    var user = getTeacher();
    if (typeof user === 'undefined')
      store.sendAction('add-teacher', "New teacher", email);
    user = getTeacher();

    store.teachers[user].addObserver(function(newStore, oldStore) {
      if (oldStore === null)
        m.mount(root, m.component(Menu, {'teacher': newStore, 'user': user}));
      else
        m.render(root, m.component(Menu, {'teacher': newStore, 'user': user}));

      m.redraw(true);
    });
  });

  var Menu = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      return m('div',
        m('.row',
          m.component(CreateClassModal, args),
          m('.col-md-8.col-md-offset-2',
            m('.panel.panel-default.menu-holder',
              m('.panel-heading',
                m('.panel-title', "Classes",
                  m('span.glyphicon.glyphicon-plus.pull-right', {
                    'onclick': function() {
                      $('#create-class-modal').modal('show');
                    }
                  })
                )
              ),
              m('.panel-body.menu-body-holder',
                m('.list-group',
                  _.pairs(args.teacher.classrooms).map(function(pairs) {
                    var classroom = pairs[1];
                    return m('.list-group-item',
                      m('h5.list-group-item-heading', classroom.name)
                    );
                  })
                )
              )
            )
          )
        )
      );
    }
  };

  var CreateClassModal = {
    'controller': function(args) {
      return {
        'name': '',
        'students': ''
      }
    },
    'view': function(ctrl, args) {
      return m('.modal.fade#create-class-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Create new class")
          ),
          m('.modal-body',
            m('div.form-horizontal',
              m('.form-group',
                m('label', "Class name"),
                m('input.form-control', {
                  'value': ctrl.name,
                  'placeholder': 'Ex. TAM 210 ADB',
                  'oninput': function(e) {
                    ctrl.name = e.target.value;
                  }
                })
              ),
              m('.form-group',
                m('label',   "Students"),
                m('p', "Enter a list of email addresses, separated by commas, spaces or newlines. (You can always add more later)."),
                m('textarea.form-control', {
                  'oninput': function(e) {
                    ctrl.students = e.target.value;
                  }
                }, ctrl.students)
              )
            )
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal'
            }, "Close"),
            m('button.btn.btn-primary', {
              'data-dismiss': 'modal',
              'disabled': ctrl.name.length < 1,
              'onclick': function(e) {
                args.teacher.sendAction('add-classroom-to-teacher', ctrl.name, []);
              }
            }, "Save")
          )
        )
      );
    }
  }

});
