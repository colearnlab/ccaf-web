/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('stateVisualizer', ['exports', 'mithril', 'underscore', 'interact'], function(exports, m, _, interact) {
  var classroom, mode;
  var modal = false;
  var savedParent;
  var interactable;
  var _args, _ctrl;

  var Visualizer = {
    'controller': function(args) {
      return {
        'mode': args.classroom.currentActivity === null ? 'edit' : 'live'
      };
    },
    'view': function(ctrl, args) {
      _args = args;
      _ctrl = ctrl;
      classroom = args.classroom;
      mode = ctrl.mode;

      var students = args.classroom.students;
      var groups = args.classroom.groups;
      var studentGroupMapping = args.classroom.studentGroupMapping;
      return (
        m('div#visualizer', {
          'onclick': function(e) {
            if (!modal) {
              var sel = window.getSelection();
              sel.removeAllRanges();
            }
          }
        },
          m.component(AddStudentsModal),
          m.component(LaunchActivityModal, args),
          m('p#statusbar',
            m('span.glyphicon.glyphicon-circle-arrow-left', {
              'onclick': function(e) {
                args.rootControl.component = 'menu';
                m.redraw(true);
              }
            }),
            m.trust("&nbsp;"),
            "Classroom: ",
            args.classroom.name,
            " ",
            m('small', (args.classroom.currentActivity !== null ? "Current activity: " + args.activities[args.classroom.currentActivity].name : "")),
            m('button.pull-right', {
              'onclick': function() {
                window.open('projector?teacher=' + args.teacher.id + '&classroom=' + args.classroom.id)
              }
            }, "Projector"),
            m('button.pull-right', {
              'style': (mode !== 'edit' ? 'display: none' : ''),
              'onclick': function() {
                if (args.classroom.currentActivity === null)
                  $('#launch-activity-modal').modal('show');
                else {
                  ctrl.mode = 'live';
                  m.redraw(true);
                }
              }
            }, (args.classroom.currentActivity === null ? "Launch activity" : "Resume activity")),
            m('button.pull-right', {
              'style': (mode === 'edit' && args.classroom.currentActivity !== null ? '' : 'display: none'),
              'onclick': function(e) {
                args.teacher.sendAction('end-activity-in-classroom', args.classroom.id);
              }
            }, "End activity"),
            m('button.pull-right', {
              'style': (mode === 'edit' ? 'display: none' : ''),
              'onclick': function() {
                  ctrl.mode = 'edit';
                  m.redraw(true);
                }
              }, "Edit")
          ),
          m('div#visualizerHolder',
            m('div#sidebar', {
              'style': (!(mode === 'edit') ? 'display:none':'')
            },
              m.component(StudentPalette, args)
            ),
            m('div#cards', {
              'style': (!(mode === 'edit') ? '' : 'margin-left: 225px;')
            },
              _.pairs(groups).map(function(pair) {
                var group = pair[1];
                var studentsInGroup = [];
                for (var student in studentGroupMapping)
                  if (studentGroupMapping[student] == pair[0])
                    studentsInGroup.push(students[student]);

                return m.component(GroupCard, {'teacher': args.teacher, 'classroom': args.classroom, 'students': students, 'group': group, 'studentsInGroup': studentsInGroup});
              })
            ),
            m('div.add-instance-container',
              m('img.add-instance-button', {
                'style': (!(mode === 'edit') ? 'display:none;':''),
                'onclick': function(e) {
                  args.teacher.sendAction('create-group-in-classroom', classroom.id, null);
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
        m('div#student-header',
          "Students",
          m('span.glyphicon.glyphicon-plus', {
            'style': !(mode === 'edit') ? 'display:none' : 'right: 10px; top:22px; position: absolute',
            'onclick': function(e) {
              $('#add-students-modal').modal('show');
              modal = true;
            }
          })
        ),
        m('div#student-list',
          m('div',
            _.values(args.classroom.students)
              .filter(function(student) {
                return (typeof args.classroom.studentGroupMapping[student.id] === 'undefined');
              })
              .map(function(student) {
                return m('div' + (mode === 'edit' ? '.student-entry' : '.student-entry-notouch'), {
                  'key': student.id,
                  'data-student': student.id
                }, student.name || student.email);
              })
          )
        )
      );
    }
  };

  var GroupCard = {
    'view': function(ctrl, args) {
      var id = args.group.id;

      var projecting = false;//typeof _.findKey(args.store.classrooms[args.classroom].projections, function(p) {return p.instanceId == id; } ) !== 'undefined';

      return m('div.instance',
        m('div.instance-title',
          m('div.instance-title-editable', {
            'contenteditable': (mode === 'edit'),
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
          'data-group': id,
          'config': function(el) {
            if (el.childElementCount > 4)
              el.style['column-count'] = el.style['-webkit-column-count'] = 2;
            else
              el.style['column-count'] = el.style['-webkit-column-count'] = 1;
          }
        },
          args.studentsInGroup.map(function(student, i) {
            var colors = ['#FFD400', '#EB6E23', '#325EAB', '#20A049'];
            return m('div' + (mode === 'edit' ? '.student-entry' : '.student-entry-notouch'), {
              'key': student.id,
              'data-student': student.id
            }, m('div.student-globe', {'style': 'background-color: ' + colors[i]}, m.trust('&nbsp;')), student.name || student.email, m.trust("&nbsp;"),
            (args.classroom.currentActivity != null ? Array.apply(null, Array(_.values(args.teacher.activities[args.classroom.currentActivity].phases).sort(function(a, b) { return a.order - b.order}).length)).map(function (_, i) {if (i == student.currentPhase) return m('span', 'X'); else return m('span', {'onclick': function() { student.sendAction('update-student', {'currentPhase': i}) }}, 'O');}) : ''),
              m('span.glyphicon.glyphicon-facetime-video.pull-right.project-button', {
                'style': 'color: ' + (student.projected ? 'orange' : 'gray') + '; ' + (mode === 'edit' || args.classroom.currentActivity === null ? 'display: none;' : ''),
                'onclick': function(e) {
                  student.sendAction('toggle-project-on-student');
                }
              })
            );
          })
        ),
        m('div.instance-footer',
          m('span.instance-button', {
            'style': (!(mode === 'edit') ? 'display:none;' : ''),
            'onclick': function() {
              classroom.sendAction('delete-group-from-classroom', id);
            }
          }, m('img', {'height': '30px', 'width': '30px', 'src': 'console/delete.png'}))
        )
      );
    }
  };

  exports.Visualizer = Visualizer;

  var savedParent;
  interact('.student-entry')
    .draggable({
      'onstart': function(event) {
        if (mode !== 'edit')
          interact.stop(event);
        var target = event.target;
        savedParent = target.parentElement;
        document.body.appendChild(target);
        target.style.top = (event.pageY - 25) + 'px';
        target.style.left = (event.pageX - 112) + 'px';
        target.style.position = 'absolute';
      },
      'onmove': function(event) {
        if (mode !== 'edit')
          interact.stop(event);
        var target = event.target,
          x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
          y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

          target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
          target.style.width = '225px';
          target.setAttribute('data-x', x);
          target.setAttribute('data-y', y);
      },
      'onend': function(event) {
        if (mode !== 'edit')
          interact.stop(event);
        var target = event.target;

        if (target.getAttribute('data-group') === null) {
          classroom.sendAction('associate-student-to-group', target.getAttribute('data-student'), null);
        }

        target.style.transform = '';
        target.style.position = '';
        target.style.width = '';
        target.setAttribute('data-x', null);
        target.setAttribute('data-y', null);

        if (savedParent.getAttribute('data-group') === null && target.getAttribute('data-group') === null)
            savedParent.appendChild(target);

        m.redraw(true);
      }
    });

    interact('.instance-student-list')
      .dropzone({
        'accept': '.student-entry',
        'ondrop': function(event) {
          var student = event.relatedTarget.getAttribute('data-student');
          var group = event.target.getAttribute('data-group');

          if (event.target.childElementCount < 8)
            classroom.sendAction('associate-student-to-group', student, group);
          event.target.classList.remove('drop-active');

          if (savedParent.getAttribute('data-group') === group)
                  savedParent.appendChild(event.relatedTarget);

          m.redraw(true);
        },
        'ondragenter': function(event) {
          var group = event.target.getAttribute('data-group');
          event.relatedTarget.setAttribute('data-group', group);
          event.target.classList.add('drop-active');
        },
        'ondragleave': function(event) {
          event.relatedTarget.removeAttribute('data-group');
          event.target.classList.remove('drop-active');
        }
      });

  var AddStudentsModal = {
    'controller': function(args) {
      return {
        'students': ''
      }
    },
    'view': function(ctrl, args) {
      return m('.modal.fade#add-students-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Add students")
          ),
          m('.modal-body',
            m('div.form-horizontal',
              m('.form-group',
                m('p', "Enter a list of email addresses. (Seperated by commas, spaces or by adding a new line)"),
                m('textarea.form-control', {
                  'oninput': function(e) {
                    ctrl.students = e.target.value;
                  }
                }, ctrl.students)
              )
            )
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal',
              'onclick': function() {
                ctrl.students = "";
                modal = false;
              }
            }, "Close"),
            m('button.btn.btn-primary', {
              'data-dismiss': 'modal',
              'disabled': ctrl.students.length < 1,
              'onclick': function(e) {
                ctrl.students.split(/(,|\s)/).filter(function(email) {
                  return email.length > 1;
                }).forEach(function(email) {
                  classroom.sendAction('add-student-to-classroom', email)
                });

                modal = false;
                ctrl.students = "";
                m.redraw(true);
              }
            }, "Add")
          )
        )
      );
    }
  };

  var LaunchActivityModal = {
    'controller': function(args) {
      return {
        'activity': null
      }
    },
    'view': function(ctrl, args) {
      return m('.modal.fade#launch-activity-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Launch activity")
          ),
          m('.modal-body',
            m('div.form-horizontal',
              m('.form-group',
                m('.list-group',
                  _.values(args.activities).map(function(activity) {
                    return m('.list-group-item' + (ctrl.activity === activity.id ? '.active' : '') + (_.values(activity.phases).length > 0 ? '' : '.disabled'), {
                      'onclick': function() {
                        if (_.values(activity.phases).length > 0)
                          ctrl.activity = activity.id;
                      }
                    },
                      activity.name, " ", (_.values(activity.phases).length > 0 ? '' : m('small', "This activity has no phases"))
                    );
                  })
                )
              )
            )
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal',
              'onclick': function() {
                ctrl.activity = null;
              }
            }, "Close"),
            m('button.btn.btn-primary#submit-new-class', {
              'data-dismiss': 'modal',
              'disabled': ctrl.activity === null,
              'onclick': function(e) {
                args.teacher.sendAction('launch-activity-in-classroom', classroom.id, ctrl.activity);
                _ctrl.mode = 'live';
                ctrl.activity = null;
                $('#launch-activity-modal').modal('hide');
                m.redraw(true);
              }
            }, "Launch!")
          )
        )
      );
    }
  };
});
