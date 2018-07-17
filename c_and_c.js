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
        this.scheduleFilePath = process.env.HUBOT_ALTERDESK_SCHEDULE_FILE || Path.join(process.cwd(), 'schedule.json');

        robot.router.get("/conversations/:chat_id/schedule/:event_id", (req, res) => {this.getEvent(req, res)});
        robot.router.get("/groupchats/:chat_id/schedule/:event_id", (req, res) => {this.getEvent(req, res)});
        robot.router.delete("/conversations/:chat_id/schedule/:event_id", (req, res) => {this.deleteEvent(req, res)});
        robot.router.delete("/groupchats/:chat_id/schedule/:event_id", (req, res) => {this.deleteEvent(req, res)});
        robot.router.post("/conversations/:chat_id/schedule", (req, res) => {this.postEvent(req, res)});
        robot.router.post("/groupchats/:chat_id/schedule", (req, res) => {this.postEvent(req, res)});
        robot.router.post("/conversations/:chat_id/trigger", (req, res) => {this.postTrigger(req, res)});
        robot.router.post("/groupchats/:chat_id/trigger", (req, res) => {this.postTrigger(req, res)});

        this.schedule;
        try {
            if (FileSystem.existsSync(this.scheduleFilePath)) {
                this.schedule = JSON.parse(FileSystem.readFileSync(this.scheduleFilePath));
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

    getEvent(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var chatId = req.params.chat_id;
            if(!chatId) {
                console.error("Invalid chat id on getEvent");
                this.respondRequest(req, res, 400, this.getJsonError("Invalid chat id"));
                return;
            }
            var eventId = req.params.event_id;
            if(!chatId) {
                console.error("Invalid event id on getEvent");
                this.respondRequest(req, res, 400, this.getJsonError("Invalid event id"));
                return;
            }
            var isGroup = req.url.startsWith("/groupchats");

            var event = this.getScheduledEvent(chatId, isGroup, eventId);
            if(!event) {
                this.respondRequest(req, res, 404, this.getJsonError("Event not found"));
                return;
            }

            this.respondRequest(req, res, 200, JSON.stringify(event));
        } catch(error) {
            console.error(error);
            this.respondRequest(req, res, 500, this.getJsonError("Get scheduled event error"));
        }
    }

    deleteEvent(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var chatId = req.params.chat_id;
            if(!chatId) {
                console.error("Invalid chat id on deleteEvent");
                this.respondRequest(req, res, 400, this.getJsonError("Invalid chat id"));
                return;
            }
            var eventId = req.params.event_id;
            if(!chatId) {
                console.error("Invalid event id on deleteEvent");
                this.respondRequest(req, res, 400, this.getJsonError("Invalid event id"));
                return;
            }
            var isGroup = req.url.startsWith("/groupchats");

            var event = this.getScheduledEvent(chatId, isGroup, eventId);
            if(!event) {
                this.respondRequest(req, res, 404, this.getJsonError("Event not found"));
                return;
            }

            this.removeFromSchedule(eventId);

            var result = {};
            result["success"] = true;
            this.respondRequest(req, res, 200, JSON.stringify(result));
        } catch(error) {
            console.error(error);
            this.respondRequest(req, res, 500, this.getJsonError("Delete scheduled event error"));
        }
    }

    postEvent(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var chatId = req.params.chat_id;
            if(!chatId) {
                console.error("Invalid chat id on postEvent");
                this.respondRequest(req, res, 400, this.getJsonError("Invalid chat id"));
                return;
            }
            var body = req.body;
            if(!body) {
                this.respondRequest(req, res, 400, this.getJsonError("Invalid body on postEvent"));
                return;
            }
            var isGroup = req.url.startsWith("/groupchats");
            var userId = body["user_id"];
            if(isGroup && (!userId || userId === "")) {
                console.error("Invalid user id on setEvent: " + userId);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid user id"));
                return;
            }
            var date = body["date"];
            if(!date || date === "") {
                console.error("Invalid date on setEvent: " + date);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid date"));
                return;
            }
            var command = body["command"];
            if(!command || command === "") {
                console.error("Invalid command on setEvent: " + command);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid command"));
                return;
            }
            var answers = body["answers"];

            var result = {};
            result["id"] = this.scheduleEvent(chatId, isGroup, userId, command, date, answers);
            this.respondRequest(req, res, 201, JSON.stringify(result));
        } catch(error) {
            console.error(error);
            this.respondRequest(req, res, 500, this.getJsonError("Schedule event error"));
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
                this.respondRequest(req, res, 400, this.getJsonError("Invalid chat id"));
                return;
            }
            var body = req.body;
            if(!body) {
                this.respondRequest(req, res, 400, this.getJsonError("Invalid body"));
                return;
            }
            var isGroup = req.url.startsWith("/groupchats");

            var userId;
            if(isGroup) {
                userId = bodu["user_id"]
            } else {
                userId = chatId;
            }
            if(!userId || userId === "") {
                console.error("Invalid user id on trigger: " + userId);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid user id"));
                return;
            }
            var command = body["command"];
            if(!command || command === "") {
                console.error("Invalid command on error: " + command);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid command"));
                return;
            }
            var answers = this.objectToAnswers(body["answers"]);
            this.executeCommand(userId, chatId, isGroup, command, answers);

            var result = {};
            result["success"] = true;

            this.respondRequest(req, res, 200, JSON.stringify(result));
        } catch(error) {
            console.error(error);
            this.respondRequest(req, res, 500, this.getJsonError("Trigger error"));
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
        var requestText = "Command::" + req.method.toLowerCase() + "() << " + req.url + ":";
        if(req.body) {
            console.log(requestText, req.body);
        } else {
            console.log(requestText);
        }
        var params = req.params;
        if(!params) {
            this.respondRequest(req, res, 400, this.getJsonError("Invalid parameters"));
            return false;
        }
        var headers = req.headers;
        if(!headers) {
            this.respondRequest(req, res, 400, this.getJsonError("Invalid request headers"));
            return false;
        }
        var token = headers["authorization"];
        if(token && this.token !== token) {
            console.error("Invalid command and control token: " + token);
            this.respondRequest(req, res, 403, this.getJsonError("Invalid authorization header"));
            return false;
        }
        return true;
    }

    respondRequest(req, res, statusCode, body) {
        console.log("Command::" + req.method.toLowerCase() + "() >> " + req.url + ": " + statusCode + ":", body);
        if(res.status) {
            res.status(statusCode);
        } else {
            res.statusCode = statusCode;
        }
        res.send(body);
    }

    getScheduledEvent(chatId, isGroup, eventId) {
        console.log("getScheduledEvent: chatId: " + chatId + " isGroup: " + isGroup + " eventId: " + eventId);
        if(!this.schedule || !this.schedule[eventId]) {
            return null;
        }
        var event = this.schedule[eventId];
        if(event["chat_id"] !== chatId || event["is_groupchat"] !== isGroup) {
            return null;
        }
        return event;
    }

    scheduleEvent(chatId, isGroup, userId, command, date, answers) {
        console.log("scheduleEvent: chatId: " + chatId + " isGroup: " + isGroup + " userId: " + userId
            + " command: " + command + " date: " + date + " answers:", answers);

        var event = {};
        event["chat_id"] = chatId;
        event["is_groupchat"] = isGroup;
        if(isGroup) {
            event["user_id"] = userId;
        }
        event["date"] = date;
        event["command"] = command;
        if(answers) {
            event["answers"] = answers;
        }

        var eventId = UuidV1();
        this.addToSchedule(eventId, event);
        console.log("Scheduled event: eventId: " + eventId);
        return eventId;
    }

    scheduleEventInMs(chatId, isGroup, userId, command, ms, answers) {
        console.log("scheduleEventInMs: chatId: " + chatId + " isGroup: " + isGroup + " userId: " + userId
            + " command: " + command + " ms: " + ms + " answers:", answers);

        var date = Moment(Date.now() + ms);
        this.scheduleEvent(chatId, isGroup, userId, command, date, answers);
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
        console.log("executeCommand: userId: " + userId + " chatId: " + chatId + " isGroup: " + isGroup
            + " command: " + command + " answers: ", answers);

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
            FileSystem.writeFileSync(this.scheduleFilePath, JSON.stringify(this.schedule), (err) => {
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
            FileSystem.writeFileSync(this.scheduleFilePath, JSON.stringify(this.schedule), (err) => {
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