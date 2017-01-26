define('main', ["exports", "mithril", "jquery", "underscore", "models", "userPicker", "bootstrap"], function(exports, m, $, _, models, userPicker) {
  var Classroom = models.Classroom;

  var UserPicker = userPicker.userPicker;

  var Shell = {
    view: function(__, component) {
      return m("div.container#main",
        m.component(component)
      );
    }
  };

  var widthClasses = ".col-xs-8.col-xs-offset-2.col-sm-8.col-sm-offset-2.col-md-6.col-md-offset-3";
  var Menu = {
    view: function(ctrl, args) {
      return m(".row",
        m(widthClasses,
            m.component(ClassroomsMenu, args)
        )
      );
    }
  };

  var ClassroomsMenu = {
    controller: function(args) {
      return {
        classrooms: Classroom.list(),
        editingClassroom: null
      };
    },
    'view': function(ctrl, args) {
      return m("div",
        (ctrl.editingClassroom ? m.component(ClassroomEditModal, {
            classroom: ctrl.editingClassroom,
            endEdit: function(reload) {
              ctrl.editingClassroom = null;
              if (reload)
                ctrl.classrooms = Classroom.list();
              m.endComputation();
            }
          })
          : ""),
        m('.panel.panel-default.menu-holder',
          m('.panel-heading',
            m('.panel-title', "Classes",
              m('span.glyphicon.glyphicon-plus.pull-right', {
                'onclick': function() {
                  ctrl.editingClassroom = new Classroom();
                }
              })
            )
          ),
          m('.panel-body.menu-body-holder',
            m(".list-group",
              ctrl.classrooms().map(function(classroom) {
                return m(".list-group-item",
                  m(".list-group-heading", classroom.title)
                );
              })
            )
          )
        )
      );
    }
  };

  var ClassroomEditModal = {
    view: function(__, args) {
      return m(".modal.fade#classroom-edit-modal", {
          config: function(el) {
            $("#classroom-edit-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", "Edit classroom")
          ),
          m(".modal-body",
            m.component(UserPicker, {
                userList: [],
                type: "student"
              })
          )
        )
      );
    }
  };

  m.route.mode = "hash";
  m.route(document.body, "/", {
    "/": m.component(Shell, Menu),
  });
});
