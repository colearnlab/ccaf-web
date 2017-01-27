define(["exports", "mithril", "css", "models", "bootstrap", "typeahead"], function(exports, m, css, models) {
  var User = models.User;

  /* args
   * userList: an array of users represented in the picker
   * type: the type of user to add if not in system, one of "administrator", "teacher", "student" or undefined to prevent adding
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
      var submit;
      return m("div", {
          config: function() {
            css.load("/shared/userPicker.css");

          }
        },
        m.component(CannotAddUserModal),
        m(".user-listing",
          ctrl.userList.map(function(user) {
              user = ctrl.availableUsers()[ctrl.availableUsers().map(function(u) { return u._id; }).indexOf(user._id)];
              return m("div", {
                  style: "background-color: " + (user.name.length === 0 ? "lightgray" : "lightblue")
                },
                (user.name.length !== 0 ? user.name + " " : "") + "<" + user.email + ">", " ",
                m("span.glyphicon.glyphicon-remove", {
                    style: "color: darkslategray; font-size: 8pt",
                    onclick: function() {
                      var indexToRemove = ctrl.userList.map(function(user) { return user._id; }).indexOf(user._id);
                      ctrl.userList.splice(indexToRemove, 1);
                    }
                  }
                )
              );
            })
        ),
        m(".user-entry",
          m("form",
            m(".input-group",
              m("input.input-sm.form-control", {
                value: ctrl.currentUser,
                config: function(el) {
                  $(el).typeahead({
                    source: ctrl.availableUsers().filter(function(user) { return (args.restrictTo ? args.restrictTo.indexOf(user.type) >= 0 : true); }),
                    displayText: function(user) {
                      return (user.name.length !== 0 ? user.name : "") + " <" + user.email + ">";
                    },
                    afterSelect: function(user) {
                      ctrl.currentUser = user.email;
                      submit.click();
                    }
                  });
                },
                oninput: function(e) {
                  ctrl.currentUser = e.target.value;
                }
              }),
              m("span.input-group-btn",
                m("button.btn.btn-sm.btn-default", {
                  disabled: ctrl.currentUser.length === 0,
                  config: function(el) {
                    submit = el;
                  },
                  onclick: function(e) {
                    ctrl.currentUser = ctrl.currentUser.toLowerCase();

                    m.startComputation();
                    var indexOfExistingUser = ctrl.userList.map(function(user) { return user.email; }).indexOf(ctrl.currentUser);
                    var indexOfUserToAdd = ctrl.availableUsers().map(function(user) { return user.email; }).indexOf(ctrl.currentUser);

                    if (indexOfExistingUser >= 0) {
                      // do nothing.
                    } else if (indexOfUserToAdd < 0 && args.type) {
                      m.startComputation();
                      var newUser = new User("", ctrl.currentUser, args.type);
                      newUser.save({
                        success: function(user) {
                          if (args.onchange)
                            args.onchange(user.data);

                          ctrl.userList.push(user.data);
                          ctrl.availableUsers = User.list();
                          m.endComputation();
                        },
                        error: function() {
                          alert("Error.");
                        }
                      });
                    } else if (indexOfUserToAdd < 0 && !args.type) {
                      $("#cannot-add-user-restricted-modal").modal("show");
                    } else if (!(args.restrictTo && args.restrictTo.indexOf(ctrl.availableUsers()[indexOfUserToAdd].type) < 0)) {
                      var toAdd = ctrl.availableUsers()[indexOfUserToAdd];
                      ctrl.userList.push(toAdd);
                      if (args.onchange)
                        args.onchange(toAdd);
                    } else {
                      $("#cannot-add-user-type-modal").modal("show");
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
      );
    }
  };

  var CannotAddUserModal = {
    view: function() {
      return m("div",
        m(".modal.fade#cannot-add-user-restricted-modal",
          m(".modal-content.col-xs-offset-3.col-sm-offset-3.col-md-offset-3.col-xs-6.col-sm-6.col-md-6",
            m(".modal-header",
              m("h4.modal-title", "Cannot add user")
            ),
            m(".modal-body", "A user with that email address is not in the system and cannot be added by you."),
            m(".modal-footer",
              m("button.btn.btn-default", {
                  onclick: function(e) {
                    $("#cannot-add-user-restricted-modal").modal("hide");
                    e.preventDefault();
                    return false;
                  }
                }, "Dismiss"
              )
            )
          )
        ),
        m(".modal.fade#cannot-add-user-type-modal",
          m(".modal-content.col-xs-offset-3.col-sm-offset-3.col-md-offset-3.col-xs-6.col-sm-6.col-md-6",
            m(".modal-header",
              m("h4.modal-title", "Cannot add user")
            ),
            m(".modal-body", "A user with that email address is in the system, but is not the correct type."),
            m(".modal-footer",
              m("button.btn.btn-default", {
                  onclick: function(e) {
                    $("#cannot-add-user-type-modal").modal("hide");
                    e.preventDefault();
                    return false;
                  }
                }, "Dismiss"
              )
            )
          )
        )
      );
    }
  };
});
