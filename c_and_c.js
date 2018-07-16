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

        robot.router.get("/conversations/:chat_id/schedule/:event_id", (req, res) => {this.getSchedule(req, res)});
        robot.router.get("/groupchats/:chat_id/schedule/:event_id", (req, res) => {this.getSchedule(req, res)});
        robot.router.delete("/conversations/:chat_id/schedule/:event_id", (req, res) => {this.deleteSchedule(req, res)});
        robot.router.delete("/groupchats/:chat_id/schedule/:event_id", (req, res) => {this.deleteSchedule(req, res)});
        robot.router.post("/conversations/:chat_id/schedule", (req, res) => {this.postSchedule(req, res)});
        robot.router.post("/groupchats/:chat_id/schedule", (req, res) => {this.postSchedule(req, res)});
        robot.router.post("/conversations/:chat_id/trigger", (req, res) => {this.postTrigger(req, res)});
        robot.router.post("/groupchats/:chat_id/trigger", (req, res) => {this.postTrigger(req, res)});

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

    getSchedule(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var chatId = req.params.chat_id;
            if(!chatId) {
                console.error("Invalid chat id on getSchedule");
                res.send(this.getJsonError("Invalid chat id"));
                return;
            }
            var eventId = req.params.event_id;
            if(!chatId) {
                console.error("Invalid event id on getSchedule");
                res.send(this.getJsonError("Invalid event id"));
                return;
            }
            var isGroup = req.url.startsWith("/groupchats");

            var event = this.getEvent(chatId, isGroup, eventId);

            if(!event) {
                res.send(this.getJsonError("Unable to get event"));
                return;
            }

            res.send(JSON.stringify(event));
        } catch(error) {
            console.error(error);
            res.send(this.getJsonError("Schedule error"));
        }
    }

    deleteSchedule(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var chatId = req.params.chat_id;
            if(!chatId) {
                console.error("Invalid chat id on deleteSchedule");
                res.send(this.getJsonError("Invalid chat id"));
                return;
            }
            var eventId = req.params.event_id;
            if(!chatId) {
                console.error("Invalid event id on deleteSchedule");
                res.send(this.getJsonError("Invalid event id"));
                return;
            }
            var isGroup = req.url.startsWith("/groupchats");

            var event = this.getEvent(chatId, isGroup, eventId);

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
    }

    postSchedule(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var chatId = req.params.chat_id;
            if(!chatId) {
                console.error("Invalid chat id on postSchedule");
                res.send(this.getJsonError("Invalid chat id"));
                return;
            }
            var body = req.body;
            if(!body) {
                res.send(this.getJsonError("Invalid body on postSchedule"));
                return;
            }
            var isGroup = req.url.startsWith("/groupchats");

            var eventId  = this.setEvent(chatId, isGroup, body);

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
    }

    postTrigger(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var chatId = req.params.chat_id;
            if(!chatId) {
                console.error("Invalid chat id");
                res.send(this.getJsonError("Invalid chat id"));
                return;
            }
            var body = req.body;
            if(!body) {
                res.send(this.getJsonError("Invalid body"));
                return;
            }
            var isGroup = req.url.startsWith("/groupchats");

            var triggered = this.trigger(chatId, isGroup, body);

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
        if(isGroup && (!userId || userId === "")) {
            console.error("Invalid user id on setEvent: " + userId);
            return null;
        }
        var date = json["date"];
        if(!date || date === "") {
            console.error("Invalid date on setEvent: " + date);
            return null;
        }
        var command = json["command"];
        if(!command || command === "") {
            console.error("Invalid command on setEvent: " + command);
            return null;
        }

        var eventId = UuidV1();

        var event = {};
        event["chat_id"] = chatId;
        event["is_groupchat"] = isGroup;
        if(isGroup) {
            event["user_id"] = userId;
        }
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
        var userId;
        if(isGroup) {
            userId = json["user_id"]
        } else {
            userId = chatId;
        }
        if(!userId || userId === "") {
            console.error("Invalid user id on trigger: " + userId);
            return false;
        }
        var command = json["command"];
        if(!command || command === "") {
            console.error("Invalid command on error: " + command);
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
        var isGroup = event["is_groupchat"];
        var chatId = event["chat_id"];
        if(!chatId || chatId === "") {
            console.error("Invalid chat id on executeEvent: " + chatId);
            return false;
        }
        var userId;
        if(isGroup) {
            userId = event["user_id"]
        } else {
            userId = chatId;
        }
        if(!userId || userId === "") {
            console.error("Invalid user id on executeEvent: " + userId);
            return false;
        }
        var command = event["command"];
        if(!command || command === "") {
            console.error("Invalid command on executeEvent: " + command);
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
            console.log("Timer already set for event on setEventTimer: " + eventId);
            return false;
        }
        if(!dateString || dateString === "") {
            console.log("Invalid dateString on setEventTimer: " + dateString);
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
            FileSystem.writeFileSync(this.scheduleFile, JSON.stringify(this.schedule), (err) => {
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
            FileSystem.writeFileSync(this.scheduleFile, JSON.stringify(this.schedule), (err) => {
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