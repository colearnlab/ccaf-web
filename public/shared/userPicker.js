define(["exports", "mithril", "css", "models"], function(exports, m, css, models) {
  var User = models.User;

  /* args
   * userList: an array of users represented in the picker
   * type: the type of user to add if not in system, one of "administrator", "teacher", "student"
   * restrictTo: an array of the type of users that can be added
   */
  exports.userPicker = {
    controller: function(args) {
      return {
        currentUser: "",
        userList: args.userList,
        availableUsers: User.list()
      };
    },
    view: function(ctrl, args) {
      return m("div", {
          config: function() {
            css.load("/shared/userPicker.css");
          }
        },
        m(".row",
          m(".user-listing",
            ctrl.userList.map(function(user) {
              return m("span", {
                  style: "background-color: " + (user.name.length === 0 ? "lightgray" : "lightblue")
                },
                user.name.length === 0 ? user.email : user.name
              );
            })
          )
        ),
        m(".row",
          m(".user-entry",
            m("form",
              m(".input-group",
                m("input.input-sm.form-control", {
                  value: ctrl.currentUser,
                  oninput: function(e) {
                    ctrl.currentUser = e.target.value;
                  }
                }),
                m("span.input-group-btn",
                  m("button.btn.btn-sm.btn-default", {
                    disabled: ctrl.currentUser.length === 0,
                    onclick: function(e) {
                      ctrl.currentUser = ctrl.currentUser.toLowerCase();

                      m.startComputation();
                      var indexOfExistingUser = ctrl.userList.map(function(user) { return user.email; }).indexOf(ctrl.currentUser);
                      var indexOfUserToAdd = ctrl.availableUsers().map(function(user) { return user.email; }).indexOf(ctrl.currentUser);

                      if (indexOfExistingUser >= 0) {
                        // do nothing.
                      } else if (indexOfUserToAdd < 0) {
                        m.startComputation();
                        var newUser = new User("", ctrl.currentUser, args.type);
                        newUser.save({
                          success: function(user) {
                            ctrl.userList.push(user.data);
                            ctrl.availableUsers = User.list();
                            m.endComputation();
                          },
                          error: function() {
                            alert("Error.");
                          }
                        });
                      } else if (!(args.restrictTo && args.restrictTo.indexOf(ctrl.availableUsers[indexOfUserToAdd]) < 0)) {
                        ctrl.userList.push(ctrl.availableUsers()[indexOfUserToAdd]);
                      }

                      ctrl.currentUser = "";
                      m.endComputation();
                      e.preventDefault();
                      return false;
                    }
                  }, "Add")
                )
              )
            )
          )
        )
      );
    }
  };
});
