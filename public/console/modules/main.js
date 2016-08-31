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
        m.mount(root, m.component(Main, {'teacher': newStore, 'user': user}));
      else
        m.render(root, m.component(Main, {'teacher': newStore, 'user': user}));

      m.redraw(true);
    });
  });

  var Main = {
    'controller': function(args) {
      return {
        'component': 'menu',
        'state': void 0
      }
    },
    'view': function(ctrl, args) {
      if (ctrl.component === 'menu')
        return m.component(Menu, _.extend(args, {'rootControl': ctrl}));
      if (ctrl.component === 'visualizer')
        return m.component(stateVisualizer.Visualizer, {'classroom': args.teacher.classrooms[ctrl.state], 'rootControl': ctrl})
    }
  };

  var classToDelete;
  var Menu = {
    'view': function(ctrl, args) {
      return m('div',
        m('.row',
          m.component(CreateClassModal, args),
          m.component(DeleteClassModal, args),
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
                      m('h5.list-group-item-heading', {
                          'onclick': function(e) {
                            args.rootControl.component = 'visualizer';
                            args.rootControl.state = pairs[0];
                          }
                        },
                        classroom.name,
                        m('span.glyphicon.glyphicon-remove.pull-right', {
                          'style': 'color: gray',
                          'onclick': function(e) {
                            $('#delete-class-modal').modal('show');
                            classToDelete = pairs[0];
                            e.stopPropagation();
                          }
                        })
                      )
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

  var DeleteClassModal = {
    'view': function(ctrl, args) {
      return m('.modal.fade#delete-class-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Delete class?")
          ),
          m('.modal-body',
            "Are you sure you want to delete this class? This cannot be undone."
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal'
            }, "Take me back"),
            m('button.btn.btn-danger', {
              'data-dismiss': 'modal',
              'onclick': function() {
                args.teacher.sendAction('delete-classroom-from-teacher', classToDelete);
                classToDelete = void 0;
              }
            }, "Delete!")
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
                var initialStudents = {};
                ctrl.students.split(/(,|\s)/).filter(function(email) {
                  return email.length > 1;
                }).forEach(function(email, i) {
                  initialStudents[i] = {'email': email};
                });
                console.log(initialStudents);
                args.teacher.sendAction('add-classroom-to-teacher', ctrl.name, initialStudents);
              }
            }, "Save")
          )
        )
      );
    }
  }

});
