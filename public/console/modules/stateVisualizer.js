/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('stateVisualizer', ['exports', 'mithril', 'underscore', 'interact'], function(exports, m, _, interact) {
  var state, isEditing;
  var savedParent;
  var interactable;

  var Visualizer = {
    'view': function(ctrl, args) {
      isEditing = true;

      var students = args.classroom.students;
      var groups = args.classroom.groups;
      var userGroupMapping = args.classroom.userGroupMapping;
      return (
        m('div#visualizer', {
          'onclick': function(e) {
            var sel = window.getSelection();
            sel.removeAllRanges();
          }
        },
          m('p#statusbar',
            m('span.glyphicon.glyphicon-circle-arrow-left', {
              'onclick': function(e) {
                args.rootControl.component = 'menu';
              }
            }),
            m.trust("&nbsp;"),
            args.classroom.name
          ),
          m('div#visualizerHolder',
            m('div#sidebar', {
              'style': (!isEditing ? 'display:none':'')
            },
              m.component(StudentPalette, args)
            ),
            m('div#cards', {
              'style': (!isEditing ? '' : 'margin-left: 225px;')
            },
              _.pairs(groups).map(function(pair) {
                var group = pair[1];
                var usersInGroup = [];
                for (user in userGroupMapping)
                  if (userGroupMapping[user] == pair[0])
                    usersInGroup.push(users[user]);

                return m.component(GroupCard, {'students': students, 'group': group, 'usersInGroup': usersInGroup});
              })
            ),
            m('div.add-instance-container',
              m('img.add-instance-button', {
                'style': (!isEditing ? 'display:none;':''),
                'onclick': function(e) {
                  args.classroom.sendAction('create-group-in-classroom', null);
                  e.stopPropagation();
                },
                'width': '64px',
                'height': '64px',
                'src': 'console/add-instance.png'
              })
            )
          )
        )
      );
    }
  };

  var StudentPalette = {
    'view': function(ctrl, args) {
      return m('div#student-palette',
        m('div#student-header', "Students"),
        m('div#student-list',
          _.values(args.classroom.students)
            .filter(function(student) {
              return typeof args.classroom.studentGroupMapping[student.id] === 'undefined';
            })
            .map(function(student) {
              return m('div.student-entry', {
                'data-student': student.id
              }, student.name || student.email);
            })
        )
      );
    }
  };

  var GroupCard = {
    'view': function(ctrl, args) {
      var id

      var projecting = false;//typeof _.findKey(args.store.classrooms[args.classroom].projections, function(p) {return p.instanceId == id; } ) !== 'undefined';

      return m('div.instance',
        m('div.instance-title',
          m('div.instance-title-editable', {
            'contenteditable': isEditing,
            'onclick': function(e) {
              e.stopPropagation();
            },
            'onkeypress': function(e) {
              return e.which != 13;
            },
            'onfocus': function(e) {
              // http://stackoverflow.com/a/3806004
              window.setTimeout(function() {
                  var sel, range;
                  if (window.getSelection && document.createRange) {
                      range = document.createRange();
                      range.selectNodeContents(e.target);
                      sel = window.getSelection();
                      sel.removeAllRanges();
                      sel.addRange(range);
                  } else if (document.body.createTextRange) {
                      range = document.body.createTextRange();
                      range.moveToElementText(e.target);
                      range.select();
                  }
              }, 1);
            },
            'oninput': function(e) {
              args.group.sendAction('set-group-name', e.target.textContent);
               m.redraw.strategy("none");
            }
          },
          args.group.name || m.trust("Tap to enter title"))
        ),
        m('div.instance-student-list', {
          'data-instance': id,
          'config': function(el) {
            if (el.childElementCount > 4)
              el.style['column-count'] = el.style['-webkit-column-count'] = 2;
            else
              el.style['column-count'] = el.style['-webkit-column-count'] = 1;
          }
        },
          _.pairs(args.userGroupMapping).filter(function(pair) {
            return pair[1] == id;
          }).map(function(pair) {
            return m('div.student-entry', {
              'data-student': pair[0]
            }, args.students[pair[0]].name || args.students[pair[0]].email);
          })
        ),
        m('div.instance-footer',
          m('span.instance-button.project-button' + (projecting ? '.projecting' : ''), {
            'onclick': function() {
              args.store.classrooms[args.classroom].sendAction('toggle-projection', id);
            }
          }, m('img', {'height': '30px', 'width': '30px', 'src': projecting ? 'console/project-on.png' : 'console/project-off.png'})),
          m('span.instance-button', {
            'style': (!isEditing ? 'display:none;' : ''),
            'onclick': function() {
              if (typeof _.findKey(args.store.classrooms[args.classroom].projections, function(p) {return p.instanceId == id; } ) !== 'undefined')
                args.store.classrooms[args.classroom].sendAction('toggle-projection', id);
              args.state.sendAction('delete-app-instance', id);
            }
          }, m('img', {'height': '30px', 'width': '30px', 'src': 'console/delete.png'}))
        )
      );
    }
  };

  var AppTray = {
    'view': function(ctrl, args) {
      var filteredApps = _.pairs(args.store.apps)
        .filter(function(pair) {
          return pair[0] !== args.avoid;
        });
      return m('div.app-tray.triangle-border.top',
          filteredApps.map(function(pair) {
            return m('div.app-selection', {
              'onclick': function() {
                args.instance.sendAction('set-instance-app', pair[0]);
              }
            },
              m('img.app-selection-icon', {
                'height': '30px',
                'src': 'apps/' + pair[0] + '/'+ pair[1].icon
              }),
              pair[1].title
            );
          }),
          m('div.app-selection', {
            'onclick': function() {
              args.instance.sendAction('set-instance-app', null);
            },
            'style': args.avoid ? '' : 'display: none'
          },
            m('img.app-selection-icon', {
              'height': '30px',
              'src': 'console/app-placeholder.png'
            }),
            "Clear selected app"
          )
      );
    }
  };

  exports.Visualizer = Visualizer;

/*

  exports.display = function(el, store, classroom, _state, _isEditing) {
    isEditing = _isEditing;
    state = _state;
    _.values(state.instances).forEach(function(instance) {
      createdInstances.push(instance);
    });

    state.addObserver(function(newState) {
      state = newState;
      m.mount(el, m.component(visualizer, {'store': store, 'classroom': classroom, 'state': newState, 'isEditing': isEditing}));
    });

    if (isEditing) {
      interactable = interact('.student-entry')
        .draggable({
          'onstart': function(event) {
            var target = event.target;
            savedParent = target.parentElement;
            document.body.appendChild(target);
            target.style.top = (event.pageY - 25) + 'px';
            target.style.left = (event.pageX - 112) + 'px';
            target.style.position = 'absolute';
          },
          'onmove': function(event) {
            var target = event.target,
              x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
              y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

              target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
              target.style.width = '225px';
              target.setAttribute('data-x', x);
              target.setAttribute('data-y', y);
          },
          'onend': function(event) {
            var target = event.target;

            savedParent.appendChild(target);

            if (target.getAttribute('data-instance') === null) {
              state.sendAction('associate-user-to-instance', target.getAttribute('data-student'), null);
            }

            target.style.transform = '';
            target.style.position = '';
            target.style.width = '';
            target.setAttribute('data-x', null);
            target.setAttribute('data-y', null);
          }
        });

      interact('.instance-student-list')
        .dropzone({
          'accept': '.student-entry',
          'ondrop': function(event) {
            var student = event.relatedTarget.getAttribute('data-student');
            var instance = event.target.getAttribute('data-instance');
            if (event.target.childElementCount < 8)
              state.sendAction('associate-user-to-instance', student, instance);
            event.target.classList.remove('drop-active');
          },
          'ondragenter': function(event) {
            var instance = event.target.getAttribute('data-instance');
            event.relatedTarget.setAttribute('data-instance', instance);
            event.target.classList.add('drop-active');
          },
          'ondragleave': function(event) {
            event.relatedTarget.removeAttribute('data-instance');
            event.target.classList.remove('drop-active');
          }
        });
    }
    else if (interactable)
      interactable.unset();
  };

  */
});
