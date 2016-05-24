/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('stateVisualizer', ['exports', 'mithril', 'underscore', 'interact'], function(exports, m, _, interact) {
  var state;

  var visualizer = {
    'view': function(ctrl, args) {
      var apps = args.store.apps;
      var instances = args.state.instances;
      var userInstanceMapping = args.state.userInstanceMapping;
      return (
        m('div#visualizer', {
          'onclick': function(e) {
            openTrays.forEach(function(openTray) {
              openTray.showAppTray = false;
            });
          }
        },
          m('p#statusbar', args.store.classrooms[args.classroom].name),
          m('div#visualizerHolder',
            m('div#sidebar',
              m.component(StudentPalette, args)
            ),
            m('div#cards', {
              'style': 'margin-left: 225px;'
            },
              _.values(instances).map(function(instance) {
                return m.component(instanceCard, {'store': args.store, 'state': args.state, 'classroom': args.classroom, 'instance': instance});
              })
            ),
            m('div.add-instance-container', {
              'onclick': function() {

              }
            },
              m('img.add-instance-button', {
                'onclick': function(e) {
                  args.state.sendAction('create-app-instance');
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
          _.pairs(args.store.classrooms[args.classroom].users)
            .filter(function(pair) {
              return typeof args.state.userInstanceMapping[pair[0]] === 'undefined';
            })
            .map(function(pair) {
              return m('div.student-entry', {
                'data-student': pair[0]
              }, pair[1].name);
            })
        )
      );
    }
  };

  var openTrays = [];
  var instanceCard = {
    'controller': function(args) {
      return {
        'showAppTray': args.instance.app ? false : true
      };
    },
    'view': function(ctrl, args) {
      var id;
      _.pairs(args.state.instances).forEach(function(pair) {
        if (pair[1] === args.instance)
          id = pair[0];
      });

      var projecting = typeof _.findKey(args.store.classrooms[args.classroom].projections, function(p) {return p.instanceId == id; } ) !== 'undefined';

      return m('div.instance',
        m('div.instance-title',
          m('img.instance-app-icon', {
            'height': '35px',
            'src': args.instance.app ? 'apps/' + args.instance.app + '/' + args.store.apps[args.instance.app].icon : 'console/app-placeholder.png',
            'onclick': function(e) {
              if (!ctrl.showAppTray) {
                openTrays.forEach(function(openTray) {
                  openTray.showAppTray = false;
                });

                m.redraw(true);
                openTrays.push(ctrl);
              }
              else
                openTrays.splice(openTrays.indexOf(ctrl), 1);

              ctrl.showAppTray = !ctrl.showAppTray;
              e.stopPropagation();
            }
          }),
          (ctrl.showAppTray ? m.component(AppTray, _.extend(args, {avoid: args.instance.app})) : ''),
          args.instance.title
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
          _.pairs(args.state.userInstanceMapping).filter(function(pair) {
            return pair[1] == id;
          }).map(function(pair) {
            return m('div.student-entry', {
              'data-student': pair[0]
            }, args.store.classrooms[args.classroom].users[pair[0]].name);
          })
        ),
        m('div.instance-footer',
          m('span.instance-button.project-button' + (projecting ? '.projecting' : ''), {
            'onclick': function() {
              args.store.classrooms[args.classroom].sendAction('toggle-projection', id);
            }
          }, m('img', {'height': '30px', 'width': '30px', 'src': projecting ? 'console/project-on.png' : 'console/project-off.png'})),
          m('span.instance-button', {
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
      return m('div.app-tray.triangle-border.top',
        _.pairs(args.store.apps)
          .filter(function(pair) {
            return pair[0] !== args.avoid;
          })
          .map(function(pair) {
            return m('div.app-selection', {
              'onclick': function() {
                args.instance.sendAction('set-instance-app', pair[0]);
              }
            },
              m('img.app-selection-icon', {
                'height': '20px',
                'src': 'apps/' + pair[0] + '/'+ pair[1].icon
              }),
              pair[1].title
            );
        })
      );
    }
  };

  var savedParent;
  interact('.student-entry')
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


  exports.display = function(el, store, classroom, _state, isLive) {
    state = _state;
    state.addObserver(function(newState) {
      state = newState;
      m.mount(el, m.component(visualizer, {'store': store, 'classroom': classroom, 'state': newState}));
    });
  };
});
