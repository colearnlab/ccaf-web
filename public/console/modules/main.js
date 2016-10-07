/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('main', ['exports', 'checkerboard', 'mithril', 'autoconnect', 'modal', 'configurationActions', './stateVisualizer', 'clientUtil', 'underscore', './activityEditor', 'loginHelper'], function(exports, checkerboard, m, autoconnect, modal, configurationActions, stateVisualizer, clientUtil, _, activityEditor, loginHelper) {
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

  var state;
  stm.init(function(store) {
    // get base element to mount to
    var root = document.getElementById('root');

    // load actions from shared source and initialize
    configurationActions.load(stm);
    store.sendAction('init');

    loginHelper.login(function(email, _user) {
      var user = getTeacher(email);
      if (typeof user === 'undefined')
        store.sendAction('add-teacher', _user.displayName, email);
      user = getTeacher(email);

      //store.teachers[user].addObserver(function(newStore, oldStore) {
      //  if (oldStore === null)
          m.mount(root, m.component(Main, {'teacher': store.teachers[user], 'apps': store.apps, 'user': user}));

    //    if (state !== 'activity-editor')
    //      m.redraw(true);
    //  });
    });

    function getTeacher(email) {
      for (var id in store.teachers) {
        if (email === store.teachers[id].email)
          return id;
      }
    }
  });

  var state;
  var Main = {
    'controller': function(args) {
      return ctrl = {
        'component': 'menu',
        'state': void 0
      }
    },
    'view': function(ctrl, args) {
      state = ctrl.component;
      if (ctrl.component === 'menu')
        return m.component(Menu, _.extend(args, {'rootControl': ctrl}));
      if (ctrl.component === 'visualizer')
        return m.component(stateVisualizer.Visualizer, {'teacher': args.teacher, 'activities': args.teacher.activities, 'classroom': args.teacher.classrooms[ctrl.state], 'rootControl': ctrl});
      if (ctrl.component === 'activity-editor')
        return m.component(activityEditor.ActivityEditor, {'teacher': args.teacher, 'activity': args.teacher.activities[ctrl.state], 'apps': args.apps, 'rootControl': ctrl});
    }
  };

  var classToDelete, activityToDelete;
  var Menu = {
    'view': function(ctrl, args) {
      return m('div',
        m('#statusbar', m.trust('&nbsp;')),
        m('.row',
          m.component(CreateClassModal, args),
          m.component(CreateActivityModal, args),
          m.component(DeleteClassModal, args),
          m.component(DeleteActivityModal, args),
          m('.col-md-6.col-md-offset-3',
            m.component(ClassroomsMenu, args),
            m.component(ActivitiesMenu, args)
          )
        )
      );
    }
  };

  var ClassroomsMenu = {
    'view': function(ctrl, args) {
      return m('.panel.panel-default.menu-holder',
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
                  " ",
                  (classroom.currentActivity !== null ? m('small', "Current activity: ", args.teacher.activities[classroom.currentActivity].name) : ''),
                  m('span.glyphicon.glyphicon-remove.pull-right', {
                    'style': 'color: gray; ' + (classroom.currentActivity !== null ? 'display: none;' : ''),
                    'onclick': function(e) {
                      $('#delete-class-modal').modal('show');
                      classToDelete = pairs[0];
                      e.stopPropagation();
                    }
                  })
                )
              );
            })
          ),
          m('div.call-to-action', {
              'style': _.keys(args.teacher.classrooms).length > 0 ? 'display: none' : ''
            },
            m('a', {
              'style': 'text-decoration: underline; cursor: pointer',
              'onclick': function(e) {
                $('#create-class-modal').modal('show');
              }
            }, "Click here"),
            " to add a new class."
          )
        )
      );
    }
  };

  var ActivitiesMenu = {
    'view': function(ctrl, args) {
      return m('.panel.panel-default.menu-holder',
        m('.panel-heading',
          m('.panel-title', "Activities",
            m('span.glyphicon.glyphicon-plus.pull-right', {
              'onclick': function() {
                $('#create-activity-modal').modal('show');
              }
            })
          )
        ),
        m('.panel-body.menu-body-holder',
          m('.list-group',
            _.pairs(args.teacher.activities).map(function(pairs) {
              var activity = pairs[1];
              return m('.list-group-item',
                m('h5.list-group-item-heading', {
                    'onclick': function(e) {
                      args.rootControl.component = 'activity-editor';
                      args.rootControl.state = pairs[0];
                    }
                  },
                  activity.name,
                  m('span.glyphicon.glyphicon-remove.pull-right', {
                    'style': 'color: gray; ' + (_.values(args.teacher.classrooms).map(function(c) { return c.currentActivity; }).indexOf(parseInt(pairs[0])) > -1 ? 'display: none' : ''),
                    'onclick': function(e) {
                      $('#delete-activity-modal').modal('show');
                      activityToDelete = pairs[0];
                      e.stopPropagation();
                    }
                  })
                )
              );
            })
          ),
          m('div.call-to-action', {
              'style': _.keys(args.teacher.activities).length > 0 ? 'display: none' : 'padding: 0 1em 0 1em'
            },
            m('a', {
              'style': 'text-decoration: underline; cursor: pointer',
              'onclick': function(e) {
                $('#create-activity-modal').modal('show');
              }
            }, "Click here"),
            " to add a new activity."
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
            m('h4.modal-title', "Add a class")
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
                  },
                  'onkeypress': function(e) {
                    if (e.keyCode == 13 && ctrl.name.length > 1)
                      $('#submit-new-class').click();
                  }
                })
              ),
              m('.form-group',
                m('label',   "Students"),
                m('p', "Enter a list of email addresses. (Seperated by commas, spaces or by adding a new line)"),
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
            m('button.btn.btn-primary#submit-new-class', {
              'data-dismiss': 'modal',
              'disabled': ctrl.name.length < 1,
              'onclick': function(e) {
                var initialStudents = {};
                ctrl.students.split(/(,|\s)/).filter(function(email) {
                  return email.length > 1;
                }).forEach(function(email, i) {
                  initialStudents[i] = {id: i, 'email': email};
                });

                args.teacher.sendAction('add-classroom-to-teacher', ctrl.name, initialStudents);
              }
            }, "Save")
          )
        )
      );
    }
  };

  var CreateActivityModal = {
    'controller': function(args) {
      return {
        'name': ''
      }
    },
    'view': function(ctrl, args) {
      return m('.modal.fade#create-activity-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Create an activity")
          ),
          m('.modal-body',
            m('div.form-horizontal',
              m('.form-group',
                m('label', "What shall it be called?"),
                m('input.form-control', {
                  'value': ctrl.name,
                  'placeholder': 'Ex. Week 7 discussion problems',
                  'oninput': function(e) {
                    ctrl.name = e.target.value;
                  },
                  'onkeypress': function(e) {
                    if (e.keyCode == 13 && ctrl.name.length > 1)
                      $('#submit-create-activity').click();
                  }
                })
              )
            )
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal'
            }, "Close"),
            m('button.btn.btn-primary#submit-create-activity', {
              'data-dismiss': 'modal',
              'disabled': ctrl.name.length < 1,
              'onclick': function(e) {
                args.teacher.sendAction('add-activity-to-teacher', ctrl.name);
              }
            }, "Save")
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
            }, "Cancel"),
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

  var DeleteActivityModal = {
    'view': function(ctrl, args) {
      return m('.modal.fade#delete-activity-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Delete activity?")
          ),
          m('.modal-body',
            "Are you sure you want to delete this activity? This cannot be undone."
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal'
            }, "Cancel"),
            m('button.btn.btn-danger', {
              'data-dismiss': 'modal',
              'onclick': function() {
                args.teacher.sendAction('delete-activity-from-teacher', activityToDelete);
                classToDelete = void 0;
              }
            }, "Delete!")
          )
        )
      );
    }
  };
});
