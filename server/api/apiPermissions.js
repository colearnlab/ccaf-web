
var userTypes = [
    "admin",
    "teacher",
    "student"
];


// This table serves as a whitelist for 

var apiAccessPermissions = {
    admin: true,
    teacher: {
        GET: {
            activity: true,
            activities: true,
            classroom_sessions: true,
            classrooms: true,
            groups: true,
            media: true,
            documents: true,
            users: true,
            visualize: true,
            snapshots: true,
            getStoreId: true
        },
        PUT: {
            activity: true,
            activities: true,
            classroom_sessions: true,
            classrooms: true,
            groups: true,
            media: true,
            documents: true,
            users: true,
        },
        POST: {
            activity: true,
            activities: true,
            classroom_sessions: true,
            classrooms: true,
            groups: true,
            media: true,
            documents: true,

            users: true,
        },
        DELETE: {
            activity: true,
            activities: true,
            classroom_sessions: true,
            classrooms: true,
            groups: true,
            media: true,
            documents: true,
            users: true,
        },
        //HEAD: {}
    },
    student: {
        GET: {
            activity: true,
            classroom_sessions: true,
            classrooms: true,
            groups: true,
            getStoreId: true,
            media: true,
            documents: true,
            users: true,
            snapshots: true
        },
        POST: {
            snapshots: true
        },
    }
};


exports.accessAllowed = function(req, apiPath) {
    var userPermissions = apiAccessPermissions[userTypes[req.user.type]];
    if(userPermissions) {
        if(userPermissions === true) {
            return true;
        } else {
            var methodPermissions = userPermissions[req.method];
            if(methodPermissions) {
                if(methodPermissions === true) {
                    return true;
                } else {
                    var pathPermissions = methodPermissions[apiPath];
                    if(pathPermissions)
                        return true;
                }
            }  
        }
    }

    console.log("" + req.user.email + " (" + userTypes[req.user.type] + ") attempted forbidden " + req.method + " request on \"" + apiPath + "\"");
    return false;
};



