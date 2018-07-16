var Moment = require('moment');
var UuidV1 = require('uuid/v1');
const {Answers} = require('hubot-questionnaire-framework');
const {User, Message, TextMessage} = require('hubot');
const FileSystem = require('fs');
const Path = require('path');

class CommandAndControl {
    constructor(robot) {
        this.robot = robot;
        this.timers = {};
        this.overrideCallbacks = {};

        this.token = process.env.HUBOT_COMMAND_AND_CONTROL_TOKEN || "TEST_TOKEN";
        this.scheduleFile = process.env.HUBOT_ALTERDESK_SCHEDULE_FILE || Path.join(process.cwd(), 'schedule.json');

        robot.router.get("/groupchats/:groupchat_id/schedule/:event_id", (req, res) => {
            try {
//                console.log("!!!! HTTP GET TEST", req, res);
                if(!this.checkRequest(req, res)) {
                    return;
                }
                var chatId = req.params.groupchat_id;
                if(!chatId) {
                    console.error("Invalid group id");
                    res.send(this.getJsonError("Invalid group id"));
                    return;
                }
                var eventId = req.params.event_id;
                if(!chatId) {
                    console.error("Invalid event id");
                    res.send(this.getJsonError("Invalid event id"));
                    return;
                }

                var event = this.getEvent(chatId, true, eventId);

                if(!event) {
                    res.send(this.getJsonError("Unable to get event"));
                    return;
                }

                res.send(JSON.stringify(event));
            } catch(error) {
                console.error(error);
                res.send(this.getJsonError("Schedule error"));
            }
        });

        robot.router.delete("/groupchats/:groupchat_id/schedule/:event_id", (req, res) => {
            try {
//                console.log("!!!! HTTP DELETE TEST", req, res);
                if(!this.checkRequest(req, res)) {
                    return;
                }
                var chatId = req.params.groupchat_id;
                if(!chatId) {
                    console.error("Invalid group id");
                    res.send(this.getJsonError("Invalid group id"));
                    return;
                }
                var eventId = req.params.event_id;
                if(!chatId) {
                    console.error("Invalid event id");
                    res.send(this.getJsonError("Invalid event id"));
                    return;
                }

                var event = this.getEvent(chatId, true, eventId);

                if(!event) {
                    res.send(this.getJsonError("Unable to delete event"));
                    return;
                }

                this.removeFromSchedule(eventId);

                var result = {};
                result["success"] = true;

                res.send(JSON.stringify(result));
            } catch(error) {
                console.error(error);
                res.send(this.getJsonError("Schedule error"));
            }
        });

        robot.router.post("/groupchats/:groupchat_id/schedule", (req, res) => {
            try {
//                console.log("!!!! HTTP POST TEST", req, res);
                if(!this.checkRequest(req, res)) {
                    return;
                }
                var chatId = req.params.groupchat_id;
                if(!chatId) {
                    console.error("Invalid group id");
                    res.send(this.getJsonError("Invalid group id"));
                    return;
                }
                var body = req.body;
                if(!body) {
                    res.send(this.getJsonError("Invalid body"));
                    return;
                }

                var eventId  = this.setEvent(chatId, true, body);

                if(!eventId) {
                    res.send(this.getJsonError("Unable to schedule event"));
                    return;
                }

                var result = {};
                result["id"] = eventId;

                res.send(JSON.stringify(result));
            } catch(error) {
                console.error(error);
                res.send(this.getJsonError("Schedule error"));
            }
        });

        robot.router.post("/groupchats/:groupchat_id/trigger", (req, res) => {
            try {
//                console.log("!!!! HTTP POST TEST", req, res);
                if(!this.checkRequest(req, res)) {
                    return;
                }
                var chatId = req.params.groupchat_id;
                if(!chatId) {
                    console.error("Invalid group id");
                    res.send(this.getJsonError("Invalid group id"));
                    return;
                }
                var body = req.body;
                if(!body) {
                    res.send(this.getJsonError("Invalid body"));
                    return;
                }

                var triggered = this.trigger(chatId, true, body);

                if(!triggered) {
                    res.send(this.getJsonError("Unable to trigger"));
                    return;
                }

                var result = {};
                result["success"] = triggered;

                res.send(JSON.stringify(result));
            } catch(error) {
                console.error(error);
                res.send(this.getJsonError("Trigger error"));
            }
        });

        this.schedule;
        try {
            if (FileSystem.existsSync(this.scheduleFile)) {
                this.schedule = JSON.parse(FileSystem.readFileSync(this.scheduleFile));
                console.log("Loaded schedule:", this.schedule);
                var eventIds = Object.keys(this.schedule);
                if(eventIds) {
                    for(var index in eventIds) {
                        var eventId = eventIds[index];
                        var event = this.schedule[eventId];
                        this.setEventTimer(eventId, event["date"]);
                    }
                }
            }
        } catch(error) {
            console.error(error);
        }
        if(!this.schedule) {
            this.schedule = {};
        }
    }

    checkRequest(req, res) {
        if(!req) {
            console.error(this.getJsonError("Invalid request object"))
            return false;
        }
        if(!res) {
            console.error(this.getJsonError("Invalid response object"))
            return false;
        }
        if(req.body) {
            console.log("Command::" + req.method + "() << " + req.url, req.body);
        } else {
            console.log("Command::" + req.method + "() << " + req.url);
        }
        var params = req.params;
        if(!params) {
            console.error("Invalid parameters");
            res.send(this.getJsonError("Invalid parameters"));
            return false;
        }
        var headers = req.headers;
        if(!headers) {
            console.error("Invalid headers");
            res.send(this.getJsonError("Invalid request headers"));
            return false;
        }
        var token = headers["authorization"];
        if(token && this.token !== token) {
            console.error("Invalid command and control token: " + token);
            res.send(this.getJsonError("Invalid authorization token"));
            return false;
        }
        return true;
    }

    getEvent(chatId, isGroup, eventId) {
        console.log("getEvent: chatId: " + chatId + " isGroup: " + isGroup + " eventId: " + eventId);
        if(!this.schedule || !this.schedule[eventId]) {
            return null;
        }
        var event = this.schedule[eventId];
        if(event["chat_id"] !== chatId || event["is_groupchat"] !== isGroup) {
            return null;
        }
        return event;
    }

    setEvent(chatId, isGroup, json) {
        console.log("setEvent: chatId: " + chatId + " isGroup: " + isGroup + " JSON: ", json);
        var userId = json["user_id"];
        var date = json["date"];
        var command = json["command"];

        if(!userId || userId === "" || !command || command === "" || !date || date === "") {
            return null;
        }

        var eventId = UuidV1();

        var event = {};
        event["chat_id"] = chatId;
        event["is_groupchat"] = isGroup;
        event["user_id"] = userId;
        event["date"] = date;
        event["command"] = command;

        var answers = json["answers"];
        if(answers) {
            event["answers"] = answers;
        }

        this.addToSchedule(eventId, event);

        console.log("Event id: " + eventId);
        return eventId;
    }

    trigger(chatId, isGroup, json) {
        console.log("trigger: chatId: " + chatId + " isGroup: " + isGroup + " JSON: ", json);
        var userId = json["user_id"];
        var command = json["command"];
        if(!userId || userId === "" || !command || command === "") {
            return false;
        }
        var answers = this.objectToAnswers(json["answers"]);
        this.executeCommand(userId, chatId, isGroup, command, answers);
        return true;
    }

    executeEvent(eventId) {
        console.log("executeEvent: eventId: " + eventId);
        var event = this.schedule[eventId];
        if(!event) {
            console.error("No event found in schedule for id: " + eventId);
            return false;
        }
        var userId = event["user_id"];
        var chatId = event["chat_id"];
        var isGroup = event["is_groupchat"];
        var command = event["command"];
        if(!userId || userId === "" || !chatId || chatId === "" || !command || command === "") {
            return false;
        }
        var answers = this.objectToAnswers(event["answers"]);
        this.executeCommand(userId, chatId, isGroup, command, answers);
        this.removeFromSchedule(eventId);
        return true;
    }

    executeCommand(userId, chatId, isGroup, command, answers) {
        console.log("executeCommand: userId: " + userId + " chatId: " + chatId + " isGroup: " + isGroup + " command: " + command + " answers: ", answers);
        var callback = this.overrideCallbacks[command];
        if(callback) {
            callback(userId, chatId, isGroup, answers);
            return;
        }
        var user = new User(userId);
        user.is_groupchat = isGroup;
        var textMessage = new TextMessage(user);
        textMessage.room = chatId;
        textMessage.text = command;
        textMessage.answers = answers;
        if(this.robot.defaultRobotReceiver) {
            this.robot.defaultRobotReceiver(textMessage);
        } else {
            this.robot.receive(textMessage);
        }
    }

    getJsonError(errorText) {
        var error = {};
        error["error"] = errorText;
        return JSON.stringify(error);
    }

    objectToAnswers(answersObject) {
        if(!answersObject) {
            return null;
        }
        var keys = Object.keys(answersObject);
        if(!keys) {
            return;
        }
        var answers = new Answers();
        for(var index in keys) {
            var key = keys[index];
            var value = answersObject[key];
            answers.add(key, value);
        }
        return answers;
    }

    setEventTimer(eventId, dateString) {
        console.log("setEventTimer: eventId: " + eventId + " date: " + dateString);
        if(this.timers[eventId]) {
            console.log("Timer already set for event: " + eventId);
            return false;
        }
        var date = Moment(dateString);
        var ms = date - Date.now();
        if(ms <= 0) {
            console.log("Event past due by " + (-ms) + " milliseconds");
            this.executeEvent(eventId);
            return false;
        }
        console.log("Event timer set: eventId: " + eventId + " ms: " + ms);
        this.timers[eventId] = setTimeout(() => {
            this.executeEvent(eventId);
        }, ms);
        return true;
    }

    removeEventTimer(eventId) {
        console.log("removeEventTimer: eventId: " + eventId);
        var timer = this.timers[eventId];
        if(!timer) {
            console.log("No timer set for event: " + eventId);
            return;
        }
        delete this.timers[eventId];
        clearTimeout(timer);
    }

    addToSchedule(eventId, event) {
        if(!this.schedule[eventId]) {
            console.log("addToSchedule: eventId: " + eventId + " event: ", event);
            this.schedule[eventId] = event;
            if(!this.setEventTimer(eventId, event["date"])) {
                return;
            }
            FileSystem.writeFile(this.scheduleFile, JSON.stringify(this.schedule), (err) => {
                if(err) {
                    this.robot.logger.error("Unable to write schedule file", err);
                }
            });
        }
    }

    removeFromSchedule(eventId) {
        if(this.schedule[eventId]) {
            console.log("removeFromSchedule: eventId: " + eventId);
            this.removeEventTimer(eventId);
            delete this.schedule[eventId];
            FileSystem.writeFile(this.scheduleFile, JSON.stringify(this.schedule), (err) => {
                if(err) {
                    this.robot.logger.error("Unable to write schedule file", err);
                }
            });
        }
    }

    setOverrideCallback(command, callback) {
        this.overrideCallbacks[command] = callback;
    }
};

// Export the classes
module.exports = {

    CommandAndControl : CommandAndControl

};