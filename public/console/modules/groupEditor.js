define(["exports", "mithril", "models", "interact"], function(exports, m, models, interact) {
  var Classroom = models.Classroom;
  var Group = models.Group;

  // Path to this will be /classroom/:classroomId
  // The main component holds the sidebar and the main groups space, as well as
  // has the logic to show/hide these components as needed.
  exports.groupEditor = {
    controller: function(args) {
      var that;
      return (that = {
        sidebarState: "open", // "open": show sidebar, can move students; "close": only groups, cannot move students
        classroom: Classroom.get(m.route.param("classroomId")),
        triggerReload: function(classroom) {
          Classroom.get(m.route.param("classroomId")).then(function(newClassroom) {
            that.classroom = m.prop(newClassroom);
            m.redraw.strategy("diff");
            m.redraw();
          });
        }
      });
    },
    view: function(ctrl, args) {
      return m(".row.stretch",
        // The sidebar: show it if mode is edit.
        m("#sidebar.stretch.bg-color-white", {
            style: ctrl.sidebarState === "open" ? "" : "display: none;"
          },
          m.component(Sidebar, {triggerReload: ctrl.triggerReload, classroom: ctrl.classroom})
        ),
        // This space holds the open/close button as welll as all the groups.
        m(".stretch#groups-holder",
          m("#close-button", {
            // If the sidebar is closed, set the text direction to RTL so only the chevron tip displays.
            // chevron tip displays. Also, move the button left to account for negative margins.
            style: ctrl.sidebarState !== "open" ? "left: 15px; direction: rtl" : "",
              onclick: function() {
                // When clicked, this button toggles between sidebar open or close state.
                ctrl.sidebarState = ctrl.sidebarState === "open" ? "close" : "open";
              }
            // Display the left or right chevron depending on open or close state.
            }, m("span.glyphicon.glyphicon-chevron-" + (ctrl.sidebarState === "open" ? "left" : "right"))
          ),
          m.component(Groups, {triggerReload: ctrl.triggerReload, classroom: ctrl.classroom})
        )
      );
    }
  };

  // A component that represents a draggable student.
  var Student = {
    view: function(__, args) {
      return m(".list-group-item.student", {
          config: function(el) {
            interact(el).draggable(createStudentDraggable(args));
          }
        },
        m(".list-group-heading", args.user.name || args.user.email)
      );
    }
  };

  var Sidebar = {
    view: function(__, args) {
      return m(".stretch",
        m(".list-group.dropzone.stretch.sidebar-body",
          // We only want to show students that are not in a group.
          args.classroom().users.filter(function(user) {
            // Iterate groups:
            for (var i = 0; i < args.classroom().groups.length; i++)
              // Iterate users in groups:
              for (var j = 0; j < args.classroom().groups[i].users.length; j++)
                // If the user is in any group, we don't want to show them in the sidebar.
                if (args.classroom().groups[i].users[j]._id === user._id)
                  return false;

            // Otherwise, if the user is not in a group we only want to show them if they are a student.
            return user.role === "student";
          }).map(function(user) {
            // Since the student is in the sidebar, we set their group to undefined.
            return m.component(Student, {triggerReload: args.triggerReload, classroom: args.classroom, user: user, groupId: void 0});
          })
        )
      );
    }
  };

  // The groups space.
  var Groups = {
    view: function(__, args) {
      args.classroom().groups = args.classroom().groups || [];
      return m(".stretch#groups.bg-color-light",
        args.classroom().groups.map(function(group, i) {
          return m(".group.bg-color-white",
            m(".group-header.primary-color-green", group.title),
            m(".group-body",
              m(".call-to-action", {
                  style: group.users.length > 0 ? "display: none" : ""
                },
                "Drag to add a student"
              ),
              m(".list-group.dropzone.stretch", {
                  "data-group": i
                },
                group.users.map(function(user) {
                  var userIdx = args.classroom().users.map(function(u) { return u._id; }).indexOf(user._id);
                  return m.component(Student, {triggerReload: args.triggerReload, classroom: args.classroom, user: args.classroom().users[userIdx], groupId: i});
                })
              )
            ),
            m(".group-footer.bg-color-med")
          );
        }),
        m("span.glyphicon.glyphicon-plus#add-group", {
            onclick: function() {
              if (typeof args.classroom().groups === "undefined")
                args.classroom().groups = [];

              args.classroom().groups.push(new Group("New group"));
              args.classroom().save();
            }
          }
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

        target.style.opacity = 0.5;

        ghost.style.position = "absolute";
        ghost.style.top = rect.top + "px";
        ghost.style.left = rect.left + "px";
        ghost.style.width = (rect.right - rect.left) + "px";

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
        var classroom = args.classroom();
        var oldGroup = parseInt(args.groupId);
        var newGroup = parseInt(document.getElementById("ghost").getAttribute("data-new-group"));
        var userId = args.user._id;

        var ghost = document.getElementById("ghost");
        ghost.parentNode.removeChild(ghost);

        if (!isNaN(newGroup)) {
          if (!isNaN(oldGroup)) {
            var oldGroupUserIndex = classroom.groups[oldGroup].users.map(function(user) { return user._id; }).indexOf(userId);
            classroom.groups[oldGroup].users.splice(oldGroupUserIndex, 1);
          }

          if (!isNaN(newGroup) && newGroup >= 0)
            classroom.groups[newGroup].users.push({_id: userId, role: "student"});

          classroom.save({
            success: function() {
              classroom.save({
                success: function(classroom) {
                  args.triggerReload();
                }
              });
            }
          });
        }

        e.target.style.opacity = 1;
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

        dropped.setAttribute("data-new-group", dropzone.getAttribute("data-group") || -1);
      }
    });
});
