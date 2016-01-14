define('pinLock', ['exports', 'mithril'], function(exports, m) { 
  exports.lock = function(passcode, el, callback) {
    m.mount(el, m.component(lock, {'passcode': passcode, 'callback': callback}));
  }
  
  var lock = {
    'view': function(ctrl, args) {
      return m('.container',
        m('br'),
        m('.row',
          m('.col-xs-4.col-xs-offset-4.col-sm-4.col-sm-offset-4.col-md-4.col-md-offset-4',
            m('.panel.panel-default', 
              m('.panel-heading', "Enter passcode"),
              m('panel-body',
                m('.form-group', {'style': 'width: 80%; margin: 0 auto; margin-top: 1em'},
                  m('input.form-control#passcode[type=\'password\']')
                ),
                [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [null, "0", null]].map(function(row, i) {
                  return m((i === 3 ? 'div' : '.btn-group'), {'style': 'margin: 0 auto; width: 80%; left: 10%; margin-top: 1em'},
                    row.map(function(key) {
                      return m('button.btn.btn-default', {
                        'style': 'width: 33%; ' + (key === null ? 'visibility: hidden' : ''),
                        'onclick': function() {
                          var passcode = document.getElementById('passcode');
                          passcode.value += key;
                          if (passcode.value.length === 4) {
                            if (passcode.value == args.passcode)
                              args.callback();
                            else
                              passcode.value = "";
                          }
                        }
                      }, key);
                    })
                  );
                }), m.trust("&nbsp;")
              )
            )
          )
        )
      );
    }
  };
});