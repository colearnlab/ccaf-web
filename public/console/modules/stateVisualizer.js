/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('stateVisualizer', ['exports', 'mithril', 'underscore', 'interact'], function(exports, m, _, interact) {
  var classroom, mode;
  var modal = false;
  var savedParent;
  var interactable;

  var Visualizer = {
    'view': function(ctrl, args) {
      classroom = args.classroom;
      mode = 'edit';

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

                return m.component(GroupCard, {'students': students, 'group': group, 'studentsInGroup': studentsInGroup});
              })
            ),
            m('div.add-instance-container',
              m('img.add-instance-button', {
                'style': (!(mode === 'edit') ? 'display:none;':''),
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
          args.studentsInGroup.map(function(student) {
            return m('div.student-entry', {
              'data-student': student.id
            }, student.name || student.email);
          })
        ),
        m('div.instance-footer',
          m('span.instance-button.project-button' + (projecting ? '.projecting' : ''), {
            'onclick': function() {
              args.store.classrooms[args.classroom].sendAction('toggle-projection', id);
            }
          }, m('img', {'height': '30px', 'width': '30px', 'src': projecting ? 'console/project-on.png' : 'console/project-off.png'})),
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

        savedParent.appendChild(target);

        if (target.getAttribute('data-group') === null) {
          classroom.sendAction('associate-student-to-group', target.getAttribute('data-student'), null);
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
          var group = event.target.getAttribute('data-group');

          if (event.target.childElementCount < 8)
            classroom.sendAction('associate-student-to-group', student, group);
          event.target.classList.remove('drop-active');
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
                m('p', "Enter a list of email addresses, separated by commas, spaces or newlines."),
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
                m.redraw(true);
              }
            }, "Save")
          )
        )
      );
    }
  }
});
