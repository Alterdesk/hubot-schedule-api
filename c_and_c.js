
var Moment = require('moment');
var UuidV1 = require('uuid/v1');

class CommandAndControl {
    constructor(robot) {
        this.robot = robot;

        this.token = process.env.HUBOT_COMMAND_AND_CONTROL_TOKEN || "TEST_TOKEN";

        robot.router.post("/groupchats/:groupchat_id/schedule", (req, res) => {
            try {
                if(!req) {
                    console.error(getJsonError("Invalid request object"))
                    return;
                }
                if(!res) {
                    console.error(getJsonError("Invalid response object"))
                    return;
                }
                var headers = req.headers;
                if(!headers) {
                    console.error("Invalid headers");
                    res.send(getJsonError("Invalid request headers"));
                    return;
                }
                var token = headers["authorization"];
                if(this.token !== token) {
                    console.error("Invalid command and control token: " + token);
                    res.send(getJsonError("Invalid authorization token"));
                    return;
                }
                var body = req.body;
                if(!body) {
                    res.send(getJsonError("Invalid body"));
                    return;
                }
//                console.log("!!!! HTTP POST TEST", req, res);
//                console.log("PARAM", req.params.groupchat_id);
//                console.log("HEADERS", req.headers);
//                console.log("TOKEN", req.headers["authorization"]);
//                console.log("BODY", req.body);

                var scheduleId = this.schedule(req.params.groupchat_id, true, body);

                if(!scheduleId) {
                    res.send(getJsonError("Unable to schedule"));
                    return;
                }

                var result = {};
                result["id"] = scheduleId;

                res.send(JSON.stringify(result));
            } catch(error) {
                console.error(error);
                res.send(getJsonError("Schedule error"));
            }
        });
    }

    schedule(chatId, isGroup, json) {
        console.log("chatId: " + chatId + " isGroup: " + isGroup + " JSON: ", json);
        console.log("userId: " + json["user_id"]);
        console.log("date: " + json["date"]);

        var scheduleId = UuidV1();

        console.log("Schedule id: " + scheduleId);
        return scheduleId;
    }

    // Format a date to a timestamp
    dateToString(date) {
        return Moment(date).utc().format("YYYY-MM-DDTHH:mm:ss") + "Z+00:00";
    };

    // Parse a timestamp to a date
    parseDate(dateString) {
        return Moment(dateString).unix();
    };

    getJsonError(errorText) {
        var error = {};
        error["error"] = errorText;
        return JSON.stringify(error);
    }
};

// Export the classes
module.exports = {

    CommandAndControl : CommandAndControl

};