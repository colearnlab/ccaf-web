define('main', ["exports", "mithril", "jquery", "models", "userPicker", "modules/groupEditor", "modules/datavis", "bootstrap"], function(exports, m, $, models, userPicker, groupEditor, dataVis) {
  var Classroom = models.Classroom;
  var User = models.User;
  var ClassroomSession = models.ClassroomSession;
  var File = models.File;

  var UserPicker = userPicker.userPicker;
  var GroupEditor = groupEditor.groupEditor;
  var DataVis = dataVis.dataVis;

  var Shell = {
    controller: function(args) {
      var ctrl = {
        me: User.me().then(function(me) {
          ctrl.classrooms = me.classrooms().then(function(classrooms) {
            classrooms.map(function(classroom) {
              classroom.sessions().then(function(sessions) {
                for (var i = 0; i < sessions.length; i++)
                  ctrl.sessions().push(sessions[i]);
              });
            });
            return classrooms;
          });
          return me;
        }),
        toolbarText: m.prop(""),
        classrooms: m.prop([]),
        sessions: m.prop([])
      };

      return ctrl;
    },
    view: function(ctrl, component) {
      return m("div.container-fluid.bg-color-med#main.stretch",
        m("#toolbar.primary-color-blue.text-color-secondary",
          m("span.glyphicon.glyphicon-circle-arrow-left#back-button", {
            style: (typeof m.route.param("classroomId") !== "undefined" || typeof m.route.param("sessionId") !== "undefined" ? "" : "display: none"),
            onclick: function() {
              m.route("/");
            }
          }),
          m("span", " ", m.trust(ctrl.toolbarText()))
        ),
        m.component(component, ctrl)
      );
    }
  };

  var widthClasses = ".col-xs-8.col-xs-offset-2.col-sm-8.col-sm-offset-2.col-md-6.col-md-offset-3";
  var Menu = {
    view: function(ctrl, args) {
      return m(".row",
        m(widthClasses,
          m.component(StartSessionMenu, args),
          m.component(ActiveSessions, args),
          m.component(ClassroomsMenu, args)
        )
      );
    }
  };

  var StartSessionMenu = {
    controller: function(args) {
      return {
        showBody: false,
        sessionName: "New session",
        classroom: null,
        sessionFile: null
      };
    },
    view: function(ctrl, args) {
      return m(".main-menu-section.bg-color-white", {
          style: args.sessions().filter(function(session) {
            return session.endTime === null;
          }).length === 0 ? "" : "display: none"
        },
        m(".main-menu-header.primary-color-green.text-color-secondary", {
            onclick: function() {
              ctrl.showBody = !ctrl.showBody;
            }
          },
          "Start a new session ", m("span.glyphicon.glyphicon-chevron-right")
        ),
        m(".main-menu-body", {
            style: "height: 250px; " + (ctrl.showBody ? "" : "display: none")
          },
          m("form.start-session-form",
            m(".form-group",
              m("label", "Title"),
              m("input.form-control", {
                value: ctrl.sessionName,
                oninput: function(e) {
                  ctrl.sessionName = e.target.value;
                }
              })
            ),
            m(".form-group",
              m("label", "Classroom"),
              m("select.form-control", {
                  value: ctrl.classroom,
                  onchange: function(e) {
                    ctrl.classroom = e.target.value;
                  }
                },
                m("option", ""),
                args.classrooms().map(function(classroom) {
                  return m("option", {value: classroom.id}, classroom.title);
                })
              )
            ),
            m(".form-group",
              m("label", {
                  style: "display: block"
                }, "PDF"),
              m("input[type=file]", {
                style: "display: inline-block",
                onchange: function(e) {
                  ctrl.sessionFile = e.target.files[0] || null;
                }
              }),
              m("button.btn.btn-primary.pull-right", {
                disabled: ctrl.sessionName.length === 0 || ctrl.classroom === null || ctrl.sessionFile === null || ctrl.sessionFile.type !== "application/pdf",
                onclick: function(e) {
                  File.upload(ctrl.sessionFile).then(function(filename) {
                    var newClassroomSession = new ClassroomSession();
                    newClassroomSession.title = ctrl.sessionName;
                    newClassroomSession.classroom = ctrl.classroom;
                    newClassroomSession.metadata = {pdf: filename.data, app: "whiteboard"};
                    newClassroomSession.save().then(function() {
                      m.route("/session/" + newClassroomSession.id);
                    });
                  });
                  return false;
                }
              }, "Start")
            )
          )
        )
      );
    }
  };

  var ActiveSessions = {
    controller: function(args) {
      return {
        sessions: ClassroomSession.list()
      };
    },
    view: function(ctrl, args) {
      var mySessions = args.sessions().filter(function(session) {
        return session.endTime === null;
      });

      return m(".main-menu-section.bg-color-white", {
          style: mySessions.length > 0 ? "" : "display: none"
        },
        m(".main-menu-header.primary-color-green.text-color-secondary", "Active Sessions"),
        m(".main-menu-body",
          m(".list-group",
            mySessions.map(function(session) {
              var classroomIdx = args.classrooms().map(function(classroom) { return classroom.id; }).indexOf(session.classroom);
              var classroom = args.classrooms()[classroomIdx];
              return m(".list-group-item.classroom",
                m(".list-group-heading", {
                    onclick: function() {
                      m.route("/session/" + session.id);
                    }
                  },
                  session.title,
                  " [",
                  classroom.title,
                  "]"
                )
              );
            })
          )
        )
      );
    }
  };

  var ClassroomsMenu = {
    controller: function(args) {
      return {
        classrooms: args.classrooms,
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
        m('.main-menu-section.bg-color-white', {
            style: args.sessions().filter(function(session) {
              return session.endTime === null;
            }).length === 0 ? "" : "display: none"
          },
          m('.main-menu-header.primary-color-blue.text-color-secondary',
            "Class Rosters",
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
            m("h4.modal-title", "Edit class")
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
            m("h4.modal-title", "Delete class?")
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
    "/classroom/:classroomId": m.component(Shell, GroupEditor),
    "/session/:sessionId": m.component(Shell, GroupEditor),
    "/visualize/:sessionId": m.component(Shell, DataVis)
  });
});
