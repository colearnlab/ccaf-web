define(["exports", "mithril", "models", "interact"], function(exports, m, models, interact) {
  var Classroom = models.Classroom;
  var Group = models.Group;
  var User = models.User;
  var ClassroomSession = models.ClassroomSession;

  var widthClasses = ".col-xs-8.col-xs-offset-2.col-sm-8.col-sm-offset-2.col-md-6.col-md-offset-3";

  // Path to this will be /classroom/:classroomId
  // The main component holds the sidebar and the main groups space, as well as
  // has the logic to show/hide these components as needed.
  exports.groupEditor = {
    controller: function(args) {
      var firstLoad = true;
      var ctrl = {
        mode: m.prop("classroom"),
        sidebarState: m.prop("open"), // "open": show sidebar, can move students; "close": only groups, cannot move students
        addState: "close",
        users: m.prop([]),
        groups: m.prop([]),
        classroom: m.prop({}),
        session: m.prop(null),
        triggerReload: function() {
          var continueReload = function(classroomId) {
            Classroom.get(classroomId).then(ctrl.classroom).then(function(classroom) {
              args.toolbarText("Classroom &rsaquo; " + classroom.title);
              var requestsToProcess = 0;
              var checkIfDone = function() {
                if (--requestsToProcess <= 0) {
                  m.redraw(true);
                }
              };
              classroom.users().then(ctrl.users);
              classroom.groups().then(ctrl.groups).then(function(groups) {
                requestsToProcess += groups.length;
                groups.forEach(function(group) {
                  group.currentUsers = m.prop([]);
                  group.users().then(group.currentUsers).then(checkIfDone);
                });
                return groups;
              });
              return classroom;
            });
          };
          if (typeof m.route.param("classroomId") !== "undefined") {
            continueReload(m.route.param("classroomId"));
          } else {
            //if (firstLoad)
            //  ctrl.sidebarState("close");
            ctrl.mode("session");
            ClassroomSession.get(m.route.param("sessionId")).then(function(classroomSession) {
              ctrl.session(classroomSession);
              continueReload(classroomSession.classroom);
            });
          }
        }
      };
      ctrl.triggerReload();
      firstLoad = false;
      return ctrl;
    },
    view: function(ctrl, args) {
      return m(".row.stretch",
        // The sidebar: show it if mode is edit.
        (ctrl.addState === "open" ? m.component(AddStudentsModal, ctrl) : ""),
        m("#sidebar.stretch.bg-color-white", {
            style: ctrl.sidebarState() === "open" ? "" : "display: none;"
          },
          m.component(Sidebar, ctrl)
        ),
        // This space holds the open/close button as welll as all the groups.
        m(".stretch#groups-holder",
            /*
          m("#close-button", {
            // If the sidebar is closed, set the text direction to RTL so only the chevron tip displays.
            // chevron tip displays. Also, move the button left to account for negative margins.
            style: ctrl.sidebarState() !== "open" ? "left: 15px; direction: rtl" : "",
              onclick: function() {
                // When clicked, this button toggles between sidebar open or close state.
                ctrl.sidebarState(ctrl.sidebarState() === "open" ? "close" : "open");
              }
            // Display the left or right chevron depending on open or close state.
          }, m("span.glyphicon.glyphicon-chevron-" + (ctrl.sidebarState() === "open" ? "left" : "right"))
            
          ),
          */
          m.component(Groups, ctrl),
          m("button.btn.btn-danger#end-session-button", {
            style: ctrl.mode() === "session" ? "" : "display: none",
            onclick: function(e) {
              ctrl.session().endTime = (+ new Date());
              ctrl.session().save().then(function() {
                //args.refreshData();
                m.route("/");
              });
            }
          },  "End session")
        )
      );
    }
  };

  // A component that represents a draggable student.
  var Student = {
    controller: function() {
      return {
        interactable: null
      };
    },
    view: function(ctrl, args) {
      return m(".list-group-item.student", {
          config: function(el, isInit, ctx) {
            if (ctrl.interactable)
              ctrl.interactable.unset();

            ctrl.interactable = interact(el).draggable(createStudentDraggable(args));
            ctx.onunload = function() {
              if (ctrl.interactable)
                ctrl.interactable.unset();
            };

            if (args.sidebarState() !== "open")
              ctrl.interactable.draggable(false);
            else
              ctrl.interactable.draggable(true);
          }
        },
        m(".list-group-heading", args.user.name || args.user.email)
      );
    }
  };

  var Sidebar = {
    view: function(__, args) {
      return m(".stretch",
        m(".sidebar-title.bg-color-light",
          "Students",
          m("span.glyphicon.glyphicon-plus.pull-right", {
            onclick: function(e) {
              args.addState = "open";
              m.redraw(true);
            }
          })
        ),
        m(".list-group.dropzone.stretch.sidebar-body",
          // We only want to show students that are not in a group.
          args.users().filter(function(user) {
            // Iterate groups:
            for (var i = 0; i < args.groups().length; i++)
              // Iterate users in groups:
              for (var j = 0; j < args.groups()[i].currentUsers().length; j++)
                // If the user is in any group, we don't want to show them in the sidebar.
                if (args.groups()[i].currentUsers()[j].id === user.id)
                  return false;

            // Otherwise, if the user is not in a group we only want to show them if they are a student.
            return user.type == User.types.student;
          }).map(function(user) {
            // Since the student is in the sidebar, we set their group to undefined.
            return m.component(Student, {triggerReload: args.triggerReload, user: user, sidebarState: args.sidebarState});
          })
        )
      );
    }
  };

  // The groups space.
  var Groups = {
    controller: function(args) {
      return {
        groups: args.groups
      };
    },
    view: function(ctrl, args) {
      return m(".stretch#groups.bg-color-light",
        ctrl.groups().map(function(group) {
          return m.component(GroupComponent, {triggerReload: args.triggerReload, group: group, sidebarState: args.sidebarState});
        }),
        m("button.btn.btn-default#add-group", {
            style: args.sidebarState() === "close" ? "display: none" : "",
            onclick: function() {
              var newGroup = new Group("Group " + (ctrl.groups().length + 1), args.classroom().id);
              newGroup.save().then(args.triggerReload);
            }
          },
          "Create group"
        )
      );
    }
  };

  var GroupComponent = {
    controller: function(args) {
      return {
        users: args.group.currentUsers,
        selected: m.route.param("selected") == args.group.id
      };
    },
    view: function(ctrl, args) {
      return m(".group.bg-color-white",
        m(".main-menu-header.primary-color-green", {
            style: ctrl.selected ? "color: white; background-color: black !important" : ""
          },
          args.group.title,
          m("span.glyphicon.glyphicon-remove.pull-right.delete-group", {
            style: (args.sidebarState() === "close" ? "display: none" : ""),
            onclick: function(e) {
              args.group.delete().then(args.triggerReload);
            }
          })
        ),
        m(".main-menu-body",
          m(".call-to-action", {
              style: args.group.currentUsers().length > 0 || args.sidebarState() === "close" ? "display: none" : ""
            },
            "Drag to add a student"
          ),
          m(".list-group.dropzone.stretch", {
              "data-group": args.group.id
            },
            args.group.currentUsers().map(function(user) {
              return m.component(Student, {triggerReload: args.triggerReload, user: user, group: args.group, sidebarState: args.sidebarState});
            })
          )
        ),
        m(".group-footer.bg-color-med")
      );
    }
  };

  var AddStudentsModal = {
    controller: function() {
      return {
        textareaContent: ""
      };
    },
    view: function(ctrl, args) {
      return m(".modal.fade#add-students-modal", {
          config: function() {
            $("#add-students-modal").modal({
              backdrop: "static"
            });
            $("#add-students-modal").modal("show");
          }
        },
        m(".modal-content" + widthClasses,
          m(".modal-header",
            m("h4.modal-title", "Add students")
          ),
          m(".modal-body",
            m("p", "Enter the email addresses of students to add:"),
            m("textarea.form-control", {
                oninput: function(e) {
                  ctrl.textareaContent = e.target.value;
                },
                value: ctrl.textareaContent
              }
            ),
            m("small", "Allowed separators: space, new line, comma, semicolon")
          ),
          m(".modal-footer",
            m("button.btn.btn-default", {
              onclick: function() {
                $("#add-students-modal").modal("hide");
                args.addState = "close";
                m.redraw(true);
              }
            }, "Cancel"),
            m("button.btn.btn-primary", {
              "data-dismiss": "modal",
              onclick: function() {
                var emails = ctrl.textareaContent.split(/[\s;, ]+/g);
                var emailsLeft = emails.length;

                var checkIfDone = function() {
                  emailsLeft--;
                  if (!emailsLeft) {
                    $("#add-students-modal").modal("hide");
                    args.addState = "close";
                    args.triggerReload();
                  }
                };

                emails.forEach(function(email) {
                  // Make it an illinois.edu email by default (for easy adding of many netIds)
                  if(!email.includes('@'))
                      email = email + '@illinois.edu';

                  var newUser = new User("", email, 2);
                  newUser.save().then(
                    function success(server) {
                        if('supplement' in server.data) {
                            var user = Object.assign(new User(), server.data.supplement);
                            user.addClassroom(args.classroom().id).then(checkIfDone);
                        } else {
                            newUser.addClassroom(args.classroom().id).then(checkIfDone);
                        }
                    }, function error(server) {
                      if (server.data.status == 409) {
                        var user = Object.assign(new User(), server.data.supplement);
                        user.addClassroom(args.classroom().id).then(checkIfDone);
                      } else {
                        checkIfDone();
                      }
                    });
                });
              }
            }, "Add")
          )
        )
      );
    }
  };

  function createStudentDraggable(args) {
    return {
      onstart: function(e) {
        var target = e.target;
        var rect = target.getBoundingClientRect();

        var ghost = target.cloneNode(true);
        ghost.id = "ghost";

        if (args.group)
          ghost.setAttribute("data-old-group", args.group.id);

        target.style.opacity = 0.5;

        ghost.style.position = "absolute";
        ghost.style.top = rect.top + "px";
        ghost.style.left = rect.left + "px";
        ghost.style.width = (rect.right - rect.left) + "px";

        ghost.original = target;

        document.getElementById("main").appendChild(ghost);
      },
      onmove: function(e) {
        var target = document.getElementById("ghost"),
            x = (parseFloat(target.getAttribute("data-x")) || 0) + e.dx,
            y = (parseFloat(target.getAttribute("data-y")) || 0) + e.dy;

        target.style.transform =
          "translate(" + x + "px, " + y + "px)";

        target.setAttribute("data-x", x);
        target.setAttribute("data-y", y);
      },
      onend: function(e) {
        var ghost = document.getElementById("ghost");
        var group = ghost.getAttribute("data-new-group");

        ghost.original.style.opacity = "1";
        document.getElementById("main").removeChild(ghost);
        if (group === "sidebar" && !isNaN(parseInt(ghost.getAttribute("data-old-group")))) {
          args.user.removeGroup(parseInt(ghost.getAttribute("data-old-group"))).then(args.triggerReload);
        } else if (group !== null) {
          args.user.addGroup(parseInt(group)).then(args.triggerReload);
        }
      }
    };
  }

  interact(".dropzone")
    .dropzone({
      ondropactivate: function(e) {
        e.target.classList.add("drop-active");
      },
      ondropdeactivate: function(e) {
        e.target.classList.remove("drop-active");
      },
      ondragenter: function(e) {
        e.target.classList.add("drop-possible");
      },
      ondragleave: function(e) {
        e.target.classList.remove("drop-possible");
      },
      ondrop: function(e) {
        var dropzone = e.target,
            dropped = document.getElementById("ghost");

        e.target.classList.remove("drop-active");
        e.target.classList.remove("drop-possible");

        dropped.setAttribute("data-new-group", dropzone.getAttribute("data-group") || "sidebar");
      }
    });
});
