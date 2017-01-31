define(["exports", "mithril", "models", "interact"], function(exports, m, models, interact) {
  var Classroom = models.Classroom;
  var Group = models.Group;

  exports.groupEditor = {
    controller: function(args) {
      return {
        mode: "edit",
        classroom: Classroom.get(m.route.param("classroomId"))
      };
    },
    view: function(ctrl, args) {
      return m(".row.stretch",
        m("#sidebar.stretch.bg-color-offwhite", {
            style: ctrl.mode === "edit" ? "" : "display: none;"
          },
          m.component(Sidebar, {classroom: ctrl.classroom})
        ),
        m(".stretch#groups-holder",
          m("#close-button", {
            style: ctrl.mode !== "edit" ? "left: 15px; direction: rtl" : "",
              onclick: function() {
                ctrl.mode = ctrl.mode === "edit" ? "live" : "edit";
              }
            }, m("span.glyphicon.glyphicon-chevron-" + (ctrl.mode === "edit" ? "left" : "right"))
          ),
          m.component(Groups, {classroom: ctrl.classroom})
        )
      );
    }
  };

  var Sidebar = {
    view: function(__, args) {
      return m(".menu-body-holder.dropzone",
        m(".list-group",
          args.classroom().users.filter(function(user) {
            return user.role === "student";
          }).map(function(user) {
            return m(".list-group-item.student",
              m(".list-group-heading", user.name || user.email)
            );
          })
        )
      );
    }
  };

  var Groups = {
    view: function(__, args) {
      args.classroom().groups = args.classroom().groups || [];
      return m(".stretch#groups",
        args.classroom().groups.map(function(group) {
          return m(".group.bg-color-offwhite",
            m(".group-header.bg-color-green", group.title),
            m(".group-body.dropzone"),
            m(".group-footer")
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

  interact(".student")
    .draggable({
      onstart: function(e) {
        var target = e.target;
        var rect = target.getBoundingClientRect();

        document.getElementById("main").appendChild(target);
        target.style.position = "absolute";
        target.style.top = rect.top + "px";
        target.style.left = rect.left + "px";
        target.style.width = (rect.right - rect.left) + "px";
      },
      onmove: function(e) {
        var target = e.target,
            x = (parseFloat(target.getAttribute("data-x")) || 0) + e.dx,
            y = (parseFloat(target.getAttribute("data-y")) || 0) + e.dy;

        target.style.transform =
          "translate(" + x + "px, " + y + "px)";

        target.setAttribute("data-x", x);
        target.setAttribute("data-y", y);
      }
    });

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
              dropped = e.relatedTarget;
          dropzone.classList.remove("drop-possible");
          dropzone.classList.remove("drop-active");
          dropzone.appendChild(dropped);
          dropped.style.position =
            dropped.style.transform =
            dropped.style.top =
            dropped.style.left = "";

            dropped.setAttribute("data-x", 0);
            dropped.setAttribute("data-y", 0);
        }
      });
});
