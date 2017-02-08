define('main', ["exports", "mithril", "jquery", "underscore", "models", "userPicker", "modules/groupEditor", "bootstrap"], function(exports, m, $, _, models, userPicker, groupEditor) {
  var Classroom = models.Classroom;
  var User = models.User;

  var UserPicker = userPicker.userPicker;
  var GroupEditor = groupEditor.groupEditor;

  var Shell = {
    controller: function(args) {
      return {
        me: User.me()
      };
    },
    view: function(ctrl, component) {
      return m("div.container-fluid.bg-color-med#main.stretch",
        m("#toolbar.primary-color-blue", " "),
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
        editingClassroom: null,
        deletingClassroom: null
      };
    },
    'view': function(ctrl, args) {
      return m("div",
        (ctrl.editingClassroom ? m.component(ClassroomEditModal, {
            me: args.me,
            classroom: ctrl.editingClassroom,
            triggerDelete: function() {
              ctrl.deletingClassroom = ctrl.editingClassroom;
            },
            endEdit: function(reload) {
              ctrl.editingClassroom = null;
              if (reload)
                Classroom.list().then(ctrl.classrooms).then(function() {
                  m.redraw(true);
                });
            }
          })
          : ""),
        (ctrl.deletingClassroom ? m.component(ClassroomDeleteModal, {
            classroom: ctrl.deletingClassroom,
            endDelete: function(reload) {
              ctrl.deletingClassroom = null;
              $("#classroom-delete-modal").modal("hide");
              if (reload) {
                ctrl.editingClassroom = null;
                $("#classroom-edit-modal").modal("hide");
                Classroom.list().then(ctrl.classrooms).then(function() {
                  m.redraw(true);
                });
              }
            }
          })
          : ""),
        m('.main-menu-section.bg-color-white',
          m('.main-menu-header.primary-color-blue.text-color-secondary',
            "Classes",
            m('span.glyphicon.glyphicon-plus.pull-right', {
              onclick: function() {
                ctrl.editingClassroom = new Classroom("", args.me().id);
              }
            })
          ),
          m('.main-menu-body',
            m(".list-group",
              ctrl.classrooms().map(function(classroom) {
                return m(".list-group-item.classroom",
                  m(".list-group-heading", {
                      onclick: function() {
                        m.route("/classroom/" + classroom.id);
                      }
                    },
                    classroom.title,
                    m("span.glyphicon.glyphicon-edit.pull-right", {
                      style: "color: gray",
                      onclick: function(e) {
                        ctrl.editingClassroom = Object.assign(new Classroom(), JSON.parse(JSON.stringify(classroom)));
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
        notOwner: args.classroom.owner !== args.me().id,
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
              m(".form-group", {
                  style: typeof ctrl.classroom.id === "undefined" ? "display: none;" : ""
                },
                m("label.control-label", "Shared with (teachers): "),
                m.component(UserPicker, {
                    classroom: ctrl.classroom,
                    restrictTo: ["administrator", "teacher"],
                    type: void 0
                  }
                )
              )
            )
          ),
          m(".modal-footer",
            m("button.btn.btn-danger.pull-left", {
              onclick: args.triggerDelete,
              style: (typeof ctrl.classroom.id === "undefined" || ctrl.notOwner ? "display: none;" : ""),
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
                  ctrl.classroom.save().then(function() {
                    args.endEdit(true);
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

  var ClassroomDeleteModal = {
    view: function(ctrl, args) {
      return m(".modal.fade#classroom-delete-modal", {
          config: function() {
            $("#classroom-delete-modal").modal({
              backdrop: "static"
            });
            $("#classroom-delete-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", "Delete classroom?")
          ),
          m(".modal-body",
            "Are you sure you want to delete this classroom? This cannot be undone."
          ),
          m(".modal-footer",
            m("button.btn.btn-default", {
              onclick: args.endDelete.bind(null, false),
            }, "Cancel"),
            m("button.btn.btn-danger", {
              "data-dismiss": "modal",
              onclick: function() {
                args.classroom.delete().then(function() {
                  args.endDelete(true);
                });
              }
            }, "Delete!")
          )
        )
      );
    }
  };

  m.route.mode = "hash";
  m.route(document.body, "/", {
    "/": m.component(Shell, Menu),
    "/classroom/:classroomId": m.component(Shell, GroupEditor)
  });
});
