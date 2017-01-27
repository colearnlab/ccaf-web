define('main', ["exports", "mithril", "jquery", "underscore", "models", "userPicker", "bootstrap"], function(exports, m, $, _, models, userPicker) {
  var Classroom = models.Classroom;
  var User = models.User;

  var UserPicker = userPicker.userPicker;

  var Shell = {
    controller: function(args) {
      return {
        me: User.me()
      };
    },
    view: function(ctrl, component) {
      return m("div.container#main",
        m.component(component, {me: ctrl.me})
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
            me: args.me,
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
                onclick: function() {
                  ctrl.editingClassroom = new Classroom();
                }
              })
            )
          ),
          m('.panel-body.menu-body-holder',
            m(".list-group",
              ctrl.classrooms().map(function(classroom) {
                return m(".list-group-item",
                  m(".list-group-heading", {
                      onclick: function() {
                        alert("hi");
                      }
                    },
                    classroom.title,
                    m("span.glyphicon.glyphicon-edit.pull-right", {
                      style: "color: gray",
                      onclick: function(e) {
                        ctrl.editingClassroom = classroom;
                        e.stopPropagation();
                      }
                    })
                  )
                );
              })
            )
          )
        )
      );
    }
  };

  var ClassroomEditModal = {
    controller: function(args) {
      return {
        notOwner: typeof args.classroom._id !== "undefined" && args.classroom.users[args.classroom.users.map(function(user) { return user._id; }).indexOf(args.me()._id)].role !== "owner",
        students: args.classroom.users.filter(function(user) { return user.role === "student"; }),
        sharedWith: args.classroom.users.filter(function(user) { return user.role === "sharedWith"; }),
        classroom: args.classroom
      };
    },
    view: function(ctrl, args) {
      return m(".modal.fade#classroom-edit-modal", {
          config: function(el) {
            $("#classroom-edit-modal").modal({
              backdrop: "static"
            });
            $("#classroom-edit-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", "Edit classroom")
          ),
          m(".modal-body",
            m("form",
              m(".form-group",
                m("label.control-label[for=classroom-modal-title]", "Title"),
                m("div",
                  m("input.input-sm.form-control#classroom-modal-title", {
                    value: ctrl.classroom.title,
                    oninput: function(el) {
                      ctrl.classroom.title = el.target.value;
                    }
                  })
                )
              ),
              m(".form-group",
                m("label.control-label", "Students: "),
                m.component(UserPicker, {
                    userList: ctrl.students,
                    restrictTo: ["student"],
                    type: "student"
                  }
                )
              ),
              m(".form-group",
                m("label.control-label", "Shared with (teachers): "),
                m.component(UserPicker, {
                    userList: ctrl.sharedWith,
                    onchange: function(user) {
                      if (user._id === args.me()._id)
                        ctrl.sharedWith.splice(ctrl.sharedWith.indexOf(user), 1);
                    },
                    restrictTo: ["teacher"],
                    type: void 0
                  }
                )
              )
            )
          ),
          m(".modal-footer",
            m("button.btn.btn-danger.pull-left", {
              style: (typeof ctrl.classroom._id === "undefined" || ctrl.notOwner ? "display: none;" : ""),
            }, "Delete"),
            m("button.btn.btn-default", {
                onclick: function(e) {
                  args.endEdit();
                },
                "data-dismiss": "modal"
              }, "Cancel"
            ),
            m("button.btn.btn-primary", {
                onclick: function() {
                  m.startComputation();

                  ctrl.students.forEach(function(student) {
                    ctrl.classroom.users.push({_id: student._id, role: "student"});
                  });

                  ctrl.sharedWith.forEach(function(teacher) {
                    ctrl.classroom.users.push({_id: teacher._id, role: "sharedWith"});
                  });

                  ctrl.classroom.users = ctrl.classroom.users.filter(function(user) {
                    var studentsIndex = ctrl.students.map(function(student) { return student._id; }).indexOf(user._id);
                    var sharedWithIndex = ctrl.sharedWith.map(function(sharedWith) { return sharedWith._id; }).indexOf(user._id);

                    return studentsIndex >= 0 || sharedWithIndex >= 0 || user.role === "owner";
                  });

                  if (typeof ctrl.classroom._id === "undefined")
                    ctrl.classroom.users.push({_id: args.me()._id, role: "owner"});

                  ctrl.classroom.save({
                    success: function() {
                      args.endEdit(true);
                    },
                    error: function() {
                      alert("Error.");
                    }
                  });
                },
                "data-dismiss": "modal"
              }, "Save"
            )
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
