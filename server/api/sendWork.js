var accessAllowed = require("./apiPermissions").accessAllowed;
var fs = require("fs");
const nodemailer = require('nodemailer');
require('dotenv').config();


var bodyParser = require('body-parser');

var work_queue = [];

// Step 1
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SEND_EMAIL,
        pass: process.env.SEND_PASSWORD
    }
});


function sendEmails () {
    var count = 0;
    while (work_queue.length != 0) {
        // Step 3
        transporter.sendMail(work_queue.shift(), (err, data) => {
            if (err) {
                console.log('Error occurs', err);
            }
        });
        count++;
        if (count == 10) {
            break;
        }
    }
}

var preTimer = setInterval(sendEmails, 60000);

exports.createRoutes = function (app, db) {
    app.use(bodyParser.json())
    app.route("/api/v1/sendWork/")
        
        .post(function (req, res) {
            if (!accessAllowed(req, "sendWork")) {
                res.status(403).json({
                    data: {
                        status: 403
                    }
                });
                return;
            }

            var students_obj = JSON.parse(req.body.emails)[0];
            var students = Object.keys(students_obj).map(function(key) {
                return [key, students_obj[key]];
            });
            var send_to_me = req.body.send_to_me;
            
            for (var i = 0; i < students.length; i++) {
                // Setup
                var snapshots = [];
                var snapshot_set = new Set();
                db.each("SELECT * from snapshots WHERE sessionId=:sessionId AND userId=:userId;", {
                        ":sessionId": req.body.session_id,
                        ":userId": students[i][1]
                    },
                    snapshots.push.bind(snapshots)
                );
                for (var j = 0; j < snapshots.length; j++) {
                    snapshot_set.add(snapshots[j].filename);
                }
            
                var snap_array = [];
                for (var it = snapshot_set.values(), val = null; val = it.next().value;) {
                    var filename = val;
                    snap_array.push({
                        "filename": filename,
                        "path": "././snapshots/" + filename
                    })
                }

                let mailOptions = {}
                if (snap_array.length > 0){
                    if (send_to_me.length > 0){
                        mailOptions = {
                            from: process.env.SEND_EMAIL, // TODO: email sender
                            to: send_to_me, // TODO: email receiver
                            subject: req.body.session_name,
                            text: 'Attached are the snapshots for ' + students[i][0] + '. If you think there is an issue with them, please contact the CSTEPS team.',
                            attachments: snap_array
                        };
                    }
                    else {
                        mailOptions = {
                            from: process.env.SEND_EMAIL, // TODO: email sender
                            to: students[i][0], // TODO: email receiver
                            subject: req.body.session_name,
                            text: 'Attached are the snapshots of your work from the IDEALl Lab. Please contact your TA if you think there is an issue with the attachments.',
                            attachments: snap_array
                        };
                    }
                }
                else {
                    if (send_to_me.length > 0){
                        mailOptions = {
                            from: process.env.SEND_EMAIL, // TODO: email sender
                            to: send_to_me, // TODO: email receiver
                            subject: req.body.session_name,
                            text: "Unable to find requested snapshots for " + students[i][0] + ". If you think there is an issue with them, please notify the CSTEPS team."
                        };
                    }
                    else {
                        mailOptions = {
                            from: process.env.SEND_EMAIL, // TODO: email sender
                            to: students[i][0], // TODO: email receiver
                            subject: req.body.session_name,
                            text: "We are unable to find snapshots of your work from the IDEALl Lab. Please contact your TA if you think there is an issue with the attachments."
                        };
                    }
                }

                work_queue.push(mailOptions);
            }

            res.status(200).json({data:{status:200}});
        })
};
