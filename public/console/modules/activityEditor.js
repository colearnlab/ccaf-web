/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('activityEditor', ['exports', 'mithril', 'underscore', 'interact'], function(exports, m, _, interact) {
  exports.ActivityEditor = {
    'view': function(ctrl, args) {
      return m('div',
        m('p#statusbar',
          m('span.glyphicon.glyphicon-circle-arrow-left.return-arrow', {
            'onclick': function(e) {
              args.rootControl.component = 'menu';
            }
          }), m.trust("&nbsp;"), "Activity: ", args.activity.name
        ),
        m.component(AddPhaseModal, args),
        m.component(RemovePhaseModal, args),
        m('.phases',
          _.values(args.activity.phases) // we are getting an array of phases and sorting them by their specified order.
            .sort(function(a, b) { return a.order - b.order})
            .map(function(phase) {
              return m.component(Phase, _.extend(_.clone(args), {'phase': phase}));
            }),
          m('.phase.add-phase-button', {
              'onclick': function(e) {
                $('#add-phase-modal').modal('show');
              }
            },
            m('span.phase-arrow.glyphicon.glyphicon-circle-arrow-right'),
            m('span.glyphicon.glyphicon-plus.add-phase-symbol')
          )
        )
      );
    }
  };


  var Phase = {
    'controller': function(args) {
      return {
        'size': 'small'
      };
    },
    'view': function(ctrl, args) {
      console.log
      return m('div.phase', {
          'style': (ctrl.size === 'large' ? 'width: 150vw; height: 150vh; position: absolute; top: -20vh; left: -20vw; z-index: 100; border: none; background-color: rgba(0,0,0,0.5); ' + (args.phase.order !== 1 ? 'margin-left:0px;': '') : '')
        },
        m('span.phase-arrow.glyphicon.glyphicon-circle-arrow-right',  {
          'style': (ctrl.size === 'large' ? 'display: none;' : '')
        }),
        m('iframe.phase-view-' + ctrl.size, {
          'key': args.phase.id,
          'src': '/client?mode=initialStateSetup&teacher=' + args.teacher.id + '&activity=' + args.activity.id + '&phase=' + args.phase.id
        }),
        m('.iframe-cover', {
          'style': (ctrl.size === 'large' ? 'display: none;' : ''),
          'onclick': function(e) {
            ctrl.size = 'large';
          }
        }, m.trust("&nbsp;")),
        m('.phase-app-icon-holder',
          m('img.phase-app-icon', {
            'style': (ctrl.size === 'large' ? 'display: none;' : ''),
            'height': '45px',
            'src': 'apps/' + args.phase.app + '/'+ args.apps[args.phase.app].icon
          })
        ),
        m('span.glyphicon.glyphicon-remove.remove-phase', {
          'style': (ctrl.size === 'large' ? 'display: none;' : ''),
          'onclick': function(e) {
            phaseToRemove = args.phase.id;
            $('#remove-phase-modal').modal('show');
          }
        }),
        m('.phase-title', {
            'style': (ctrl.size === 'small' ? 'display: none;' : ''),
            'onclick': function(e) {
              ctrl.size = 'small';
            }
          },
            "Editing phase ", args.phase.order, " (click ", m('span.underline', "here"), " to return)"
        )
      );
    }
  };

  var AddPhaseModal = {
    'controller': function(args) {
      return {
        'app': null
      }
    },
    'view': function(ctrl, args) {
      return m('.modal.fade#add-phase-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Add phase")
          ),
          m('.modal-body',
            m('div.form-horizontal',
              m('.form-group',
                m('label', "App"),
                m('p', "Which app will students use in this phase?"),
                m('.list-group',
                  _.pairs(args.apps).map(function(pair) {
                    return m('.list-group-item' + (ctrl.app === pair[0] ? '.active' : ''), {
                      'onclick': function() {
                        ctrl.app = pair[0];
                      }
                    },
                      m('img.app-selection-icon', {
                        'height': '30px',
                        'src': 'apps/' + pair[0] + '/'+ pair[1].icon
                      }),
                      pair[1].title
                    );
                  })
                )
              )
            )
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal'
            }, "Close"),
            m('button.btn.btn-primary#submit-new-class', {
              'data-dismiss': 'modal',
              'disabled': ctrl.app === null,
              'onclick': function(e) {
                args.activity.sendAction('add-phase-to-activity', ctrl.app);
                ctrl.app = null;
                $('#add-phase-modal').modal('hide');
              }
            }, "Add")
          )
        )
      );
    }
  };

  var RemovePhaseModal = {
    'view': function(ctrl, args) {
      return m('.modal.fade#remove-phase-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Delete phase?")
          ),
          m('.modal-body',
            "Are you sure you want to delete this phase? This cannot be undone."
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal'
            }, "Take me back"),
            m('button.btn.btn-danger', {
              'data-dismiss': 'modal',
              'onclick': function() {
                args.activity.sendAction('remove-phase-from-activity', phaseToRemove);
                phaseToRemove = void 0;
              }
            }, "Delete!")
          )
        )
      );
    }
  };

});
