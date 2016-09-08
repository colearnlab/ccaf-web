define('loginHelper', ['exports'], function(exports, m, _) {
  var apiKey = 'AIzaSyB7kpd6apGLyKVF69m3uZ5zI_Z7S8dv3G0';
  var clientId = '28967180344-1gbtncntpn95jvtbuumha98j305ic8cr.apps.googleusercontent.com';
  var accessToken;

  exports.login = function(success, failure) {
    var params = {}, queryString = location.hash.substring(1),
        regex = /([^&=]+)=([^&]*)/g, q;
    while (q = regex.exec(queryString)) {
      params[decodeURIComponent(q[1])] = decodeURIComponent(q[2]);
    }

    if (typeof params['access_token'] === 'undefined')
      redirectToLogin();

    accessToken = params['access_token'];

    $.ajax('https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + params['access_token'], {
      'success': function() {
        $.ajax('https://www.googleapis.com/plus/v1/people/me?key=' + apiKey, {
          'headers': {
            'Authorization': 'Bearer ' + accessToken
          },
          'success': function(user) {
            user.emails.forEach(function(email) {
              if (email.type === "account")
                success(email.value, user);
            });
          },
          'error': redirectToLogin
        });
      },
      'error': redirectToLogin
    });

    location.hash = "";
  }

  function redirectToLogin() {
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=' + clientId + '&redirect_uri=' + location.href.split('#')[0] + '&scope=profile%20email';
  }
});
