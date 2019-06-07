var Moment = require('moment');
var UuidV1 = require('uuid/v1');
const {Answers} = require('hubot-questionnaire-framework');
const Logger = require('node-messenger-log');
const {User, Message, TextMessage} = require('hubot');
const FileSystem = require('fs');
const Path = require('path');

// Set the log instance
var Logger = new Logger(process.env.HUBOT_SCHEDULE_API_LOG_LEVEL || process.env.HUBOT_LOG_LEVEL || 'debug');

class Schedule {
    constructor(robot, control) {
        this.robot = robot;
        this.control = control;
        this.timers = {};
        this.overrideCallbacks = {};

        this.token = process.env.HUBOT_SCHEDULE_API_TOKEN;
        if(!this.token || this.token === "") {
            Logger.error("Schedule::constructor() No token configured!");
        }

        var app;
        if(process.env.HUBOT_SCHEDULE_API_SERVER) {
            var express = require('express');
            app = express();
            app.use(express.json());

            var port = process.env.HUBOT_SCHEDULE_API_PORT || 8443;
            var host = process.env.HUBOT_SCHEDULE_API_HOST || "0.0.0.0";
            var keyPath = process.env.HUBOT_SCHEDULE_API_KEY_PATH;
            var certPath = process.env.HUBOT_SCHEDULE_API_CERT_PATH;
            if(keyPath && keyPath !== "" && certPath && certPath !== "") {
                var options = {
                   key: FileSystem.readFileSync(keyPath),
                   cert: FileSystem.readFileSync(certPath),
                   passphrase: process.env.HUBOT_SCHEDULE_API_CERT_PASS
                };
                var https = require('https');
                https.createServer(options, app).listen(port, host, () => {
                    Logger.debug("Schedule::constructor() Started HTTPS schedule API server on port " + port);
                });
            } else {
                var http = require('http');
                http.createServer(app).listen(port, host, () => {
                    Logger.debug("Schedule::constructor() Started HTTP schedule API server on port " + port);
                });
            }
        } else {
            // Use Hubot default express instance
            Logger.debug("Schedule::constructor() Using default Hubot HTTP server for schedule API");
            app = robot.router;
        }

        app.get("/stats/configured", (req, res) => {this.getConfigured(req, res)});
        app.get("/stats/connected", (req, res) => {this.getConnected(req, res)});
        app.get("/stats/questionnaires", (req, res) => {this.getQuestionnaires(req, res)});

        app.get("/actions/stop", (req, res) => {this.getStop(req, res)});
        app.get("/actions/kill", (req, res) => {this.getKill(req, res)});

        app.get("/conversations/:chat_id/schedule/:event_id", (req, res) => {this.getEvent(req, res)});
        app.get("/groupchats/:chat_id/schedule/:event_id", (req, res) => {this.getEvent(req, res)});
        app.delete("/conversations/:chat_id/schedule/:event_id", (req, res) => {this.deleteEvent(req, res)});
        app.delete("/groupchats/:chat_id/schedule/:event_id", (req, res) => {this.deleteEvent(req, res)});
        app.post("/conversations/:chat_id/schedule", (req, res) => {this.postEvent(req, res)});
        app.post("/groupchats/:chat_id/schedule", (req, res) => {this.postEvent(req, res)});
        app.post("/conversations/:chat_id/trigger", (req, res) => {this.postTrigger(req, res)});
        app.post("/groupchats/:chat_id/trigger", (req, res) => {this.postTrigger(req, res)});

        this.scheduleFilePath = process.env.HUBOT_ALTERDESK_SCHEDULE_FILE_PATH || Path.join(process.cwd(), 'schedule.json');
        this.schedule;
        try {
            if (FileSystem.existsSync(this.scheduleFilePath)) {
                this.schedule = JSON.parse(FileSystem.readFileSync(this.scheduleFilePath));
                Logger.debug("Schedule::constructor() Loaded schedule:", this.schedule);
                var eventIds = Object.keys(this.schedule);
                if(eventIds) {
                    for(var index in eventIds) {
                        var eventId = eventIds[index];
                        var event = this.schedule[eventId];
                        this.setEventTimer(event);
                    }
                }
            }
        } catch(error) {
            Logger.error("Schedule::constructor() Load schedule error:", error);
        }
        if(!this.schedule) {
            this.schedule = {};
        }
    }

    getConfigured(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var result = {};
            result["result"] = this.control.acceptedCommands.length > 0;
            this.respondRequest(req, res, 200, JSON.stringify(result));
        } catch(error) {
            Logger.error("Schedule::getConfigured()", error);
            this.respondRequest(req, res, 500, this.getJsonError("Get configured event error"));
        }
    }

    getConnected(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
               return;
            }
            var connected = false;
            if(this.robot.adapter && typeof this.robot.adapter.connected === "boolean") {
                connected = this.robot.adapter.connected;
            }
            var result = {};
            result["result"] = connected;
            this.respondRequest(req, res, 200, JSON.stringify(result));
        } catch(error) {
            Logger.error("Schedule::getConnected()", error);
            this.respondRequest(req, res, 500, this.getJsonError("Get connected event error"));
        }
    }

    getQuestionnaires(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var questionnaires = this.control.getActiveQuestionnaires();
            this.respondRequest(req, res, 200, JSON.stringify(questionnaires));
        } catch(error) {
            Logger.error("Schedule::getQuestionnaires()", error);
            this.respondRequest(req, res, 500, this.getJsonError("Get questionnaires event error"));
        }
    }

    getStop(req, res) {
        var exitNow = false;
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            exitNow = this.control.armExitOnIdle(true);
            var result = {};
            result["result"] = true;
            this.respondRequest(req, res, 200, JSON.stringify(result));
        } catch(error) {
            Logger.error("Schedule::getStop()", error);
            this.respondRequest(req, res, 500, this.getJsonError("Get stop event error"));
        }
        if(exitNow) {
            Logger.debug("Schedule::getStop() Is idle now, exiting");
            process.exit(0);
        }
    }

    getKill(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var result = {};
            result["result"] = true;
            this.respondRequest(req, res, 200, JSON.stringify(result));
        } catch(error) {
            Logger.error("Schedule::getKill()", error);
            this.respondRequest(req, res, 500, this.getJsonError("Get kill event error"));
        }
        process.exit(1);
    }

    getEvent(req, res) {
        try {
            if(!this.checkRequest(req, res)) {
                return;
            }
            var chatId = req.params.chat_id;
            if(!chatId) {
                Logger.error("Schedule::getEvent() Invalid chat id");
                this.respondRequest(req, res, 400, this.getJsonError("Invalid chat id"));
                return;
            }
            var eventId = req.params.event_id;
            if(!chatId) {
                Logger.error("Schedule::getEvent() Invalid event id");
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
            Logger.error("Schedule::getEvent()", error);
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
                Logger.error("Schedule::deleteEvent() Invalid chat id");
                this.respondRequest(req, res, 400, this.getJsonError("Invalid chat id"));
                return;
            }
            var eventId = req.params.event_id;
            if(!chatId) {
                Logger.error("Schedule::deleteEvent() Invalid event id");
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
            Logger.error("Schedule::deleteEvent()", error);
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
                Logger.error("Schedule::postEvent() Invalid chat id");
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
                Logger.error("Schedule::postEvent() Invalid user id: " + userId);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid user id"));
                return;
            }
            var command = body["command"];
            if(!command || command === "") {
                Logger.error("Schedule::postEvent() Invalid command: " + command);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid command"));
                return;
            }
            var answers = body["answers"];

            var eventId;

            var date = body["date"];
            var times = body["times"];
            var days = body["week_days"];
            var excludes = body["exclude_dates"];
            if(date && date !== "") {
                eventId = this.scheduleEvent(chatId, isGroup, userId, command, date, answers);
            } else if(times && times.length > 0) {
                eventId = this.scheduleRepeatedEvent(chatId, isGroup, userId, command, times, days, excludes, answers);
            } else {
                Logger.error("Schedule::postEvent() Invalid date: " + date);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid date"));
                return;
            }

            var result = {};
            result["id"] = eventId;
            this.respondRequest(req, res, 201, JSON.stringify(result));
        } catch(error) {
            Logger.error("Schedule::postEvent()", error);
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
                Logger.error("Schedule::postTrigger() Invalid chat id");
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
                userId = body["user_id"]
            } else {
                userId = chatId;
            }
            if(!userId || userId === "") {
                Logger.error("Schedule::postTrigger() Invalid user id: " + userId);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid user id"));
                return;
            }
            var command = body["command"];
            if(!command || command === "") {
                Logger.error("Schedule::postTrigger() Invalid command: " + command);
                this.respondRequest(req, res, 400, this.getJsonError("Invalid command"));
                return;
            }
            var answers = Answers.fromObject(body["answers"]);
            this.executeCommand(chatId, isGroup, userId, command, answers);

            var result = {};
            result["success"] = true;

            this.respondRequest(req, res, 200, JSON.stringify(result));
        } catch(error) {
            Logger.error("Schedule::postTrigger()", error);
            this.respondRequest(req, res, 500, this.getJsonError("Trigger error"));
        }
    }

    checkRequest(req, res) {
        if(!req) {
            Logger.error("Schedule::checkRequest() Invalid request object");
            return false;
        }
        if(!res) {
            Logger.error("Schedule::checkRequest() Invalid response object");
            return false;
        }
        var requestText = "Schedule::" + req.method.toLowerCase() + "() << " + req.url + ":";
        if(req.body) {
            Logger.debug(requestText, req.body);
        } else {
            Logger.debug(requestText);
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
        if(!this.token || this.token === "") {
            Logger.error("Schedule::checkRequest() No token configured!");
            return true;
        }
        var token = headers["authorization"];
        if(typeof token !== "string") {
            Logger.error("Schedule::checkRequest() Invalid schedule API token: " + token);
            this.respondRequest(req, res, 403, this.getJsonError("Invalid authorization token"));
            return false;
        }
        token = token.replace("Bearer ", "");
        if(this.token !== token) {
            Logger.error("Schedule::checkRequest() Invalid schedule API token: " + token);
            this.respondRequest(req, res, 403, this.getJsonError("Invalid authorization token"));
            return false;
        }
        return true;
    }

    respondRequest(req, res, statusCode, body) {
        Logger.debug("Schedule::" + req.method.toLowerCase() + "() >> " + req.url + ": " + statusCode + ":", body);
        if(res.status) {
            res.status(statusCode);
        } else {
            res.statusCode = statusCode;
        }
        res.send(body);
    }

    getScheduledEvent(chatId, isGroup, eventId) {
        Logger.debug("Schedule::getScheduledEvent() chatId: " + chatId + " isGroup: " + isGroup + " eventId: " + eventId);
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
        Logger.debug("Schedule::scheduleEvent() chatId: " + chatId + " isGroup: " + isGroup + " userId: " + userId
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
            if(answers instanceof Answers) {
                event["answers"] = answers.toObject();
            } else {
                event["answers"] = answers;
            }
        }

        var eventId = UuidV1();
        event["id"] = eventId;

        this.addToSchedule(event);
        Logger.debug("Schedule::scheduleEvent() Scheduled eventId: " + eventId);
        return eventId;
    }

    scheduleEventInMs(chatId, isGroup, userId, command, ms, answers) {
        Logger.debug("Schedule::scheduleEventInMs() chatId: " + chatId + " isGroup: " + isGroup + " userId: " + userId
            + " command: " + command + " ms: " + ms + " answers:", answers);

        var date = Moment(Date.now() + ms);
        this.scheduleEvent(chatId, isGroup, userId, command, date, answers);
    }

    scheduleRepeatedEvent(chatId, isGroup, userId, command, times, days, excludes, answers) {
        Logger.debug("Schedule::scheduleRepeatedEvent() chatId: " + chatId + " isGroup: " + isGroup + " userId: " + userId
            + " command: " + command + " times: " + times + " days: " + days + " excludes: " + excludes
            + " answers:", answers);

        var event = {};
        event["chat_id"] = chatId;
        event["is_groupchat"] = isGroup;
        if(isGroup) {
            event["user_id"] = userId;
        }
        event["times"] = times.sort();
        if(days && days.length > 0) {
            event["week_days"] = days.sort();
        }
        if(excludes && excludes.length > 0) {
            event["exclude_dates"] = excludes.sort();
        }
        event["command"] = command;
        if(answers) {
            if(answers instanceof Answers) {
                event["answers"] = answers.toObject();
            } else {
                event["answers"] = answers;
            }
        }

        var eventId = UuidV1();
        event["id"] = eventId;

        this.addToSchedule(event);
        Logger.debug("Schedule::scheduleRepeatedEvent() Scheduled repeated eventId: " + eventId);
        return eventId;
    }

    executeEvent(eventId) {
        Logger.debug("Schedule::executeEvent() eventId: " + eventId);
        var event = this.schedule[eventId];
        if(!event) {
            Logger.error("Schedule::executeEvent() No event found in schedule for id: " + eventId);
            return false;
        }
        var isGroup = event["is_groupchat"];
        var chatId = event["chat_id"];
        if(!chatId || chatId === "") {
            Logger.error("Schedule::executeEvent() Invalid chat id: " + chatId);
            return false;
        }
        var userId;
        if(isGroup) {
            userId = event["user_id"]
        } else {
            userId = chatId;
        }
        if(!userId || userId === "") {
            Logger.error("Schedule::executeEvent() Invalid user id: " + userId);
            return false;
        }
        var command = event["command"];
        if(!command || command === "") {
            Logger.error("Schedule::executeEvent() Invalid command: " + command);
            return false;
        }
        var answers = Answers.fromObject(event["answers"]);
        this.executeCommand(chatId, isGroup, userId, command, answers);
        var times = event["times"];
        if(times && times.length > 0) {
            // Repeated event, set next timer
            this.removeEventTimer(eventId);
            setTimeout(() => {
                this.setEventTimer(event);
            }, 1000);
        } else {
            // One time event, remove from schedule
            this.removeFromSchedule(eventId);
        }
        return true;
    }

    executeCommand(chatId, isGroup, userId, command, answers) {
        Logger.debug("Schedule::executeCommand() chatId: " + chatId + " isGroup: " + isGroup + " userId: " + userId
            + " command: " + command + " answers: ", answers);

        var callback = this.overrideCallbacks[command.toUpperCase()];
        if(callback) {
            Logger.debug("Schedule::executeCommand() Override callback: " + callback);
            callback(chatId, isGroup, userId, answers);
            return;
        }
        var user = new User(userId);
        user.is_groupchat = isGroup;
        var textMessage = new TextMessage(user);
        textMessage.room = chatId;
        textMessage.text = command;
        textMessage.answers = answers;
        this.robot.receive(textMessage);
    }

    getJsonError(errorText) {
        var error = {};
        error["error"] = errorText;
        return JSON.stringify(error);
    }

    calculateNextDate(event) {
        var date = event["date"];
        if(date && date !== "") {
            // One-time event
            return date;
        }
        var times = event["times"];
        if(!times || times.length == 0) {
            Logger.error("Schedule::calculateNextDate() Event has no valid time configuration", event);
            return null;
        }
        var now = new Date();
        var checkMoment = Moment(now).utc();
        Logger.debug("Schedule::calculateNextDate() " + checkMoment.format("YYYY-MM-DDTHH:mm:ss") + "Z");
        if(this.checkDateForEvent(event, checkMoment)) {
            var year = checkMoment.year();
            var month = checkMoment.month();
            var day = checkMoment.date();
            for(var index in times) {
                var time = times[index];
                var timeSplit = time.split(":");
                var hours = timeSplit[0];
                var minutes = timeSplit[1];
                var seconds = timeSplit[2];
                var candidateDate = Moment({y:year, M:month, d:day, h:hours, m:minutes, s:seconds}).utcOffset(0, true);
                Logger.debug("Schedule::calculateNextDate() Candidate date: " + candidateDate.format("YYYY-MM-DDTHH:mm:ss") + "Z");
                var diff = candidateDate.diff(checkMoment);
                // Check if time is in the future
                if(diff >= 0) {
                    return candidateDate.format("YYYY-MM-DDTHH:mm:ss") + "Z";
                }
            }
        }

        do {
            checkMoment = checkMoment.add(1, "day");
        } while(!this.checkDateForEvent(event, checkMoment));
        return checkMoment.format("YYYY-MM-DD") + "T" + times[0] + "Z";
    }

    checkDateForEvent(event, checkMoment) {
        var checkDate = checkMoment.format("YYYY-MM-DD");
        Logger.debug("Schedule::checkDateForEvent() " + checkDate);
        var excludes = event["exclude_dates"];
        if(excludes && excludes.length > 0) {
            for(var index in excludes) {
                var exclude = excludes[index];
                if(checkDate === exclude) {
                    Logger.debug("Schedule::checkDateForEvent() Excluded date: " + exclude);
                    return false;
                }
            }
        }
        var days = event["week_days"];
        if(days && days.length > 0) {
            var checkDay = checkMoment.isoWeekday();
            for(var index in days) {
                var day = days[index];
                if(checkDay === day) {
                    Logger.debug("Schedule::checkDateForEvent() Accepted day of the week: " + day);
                    return true;
                }
            }
            Logger.debug("Schedule::checkDateForEvent() Unaccepted day of the week: " + checkDay);
            return false;
        }
        return true;
    }

    setEventTimer(event) {
        var eventId = event["id"];
        if(!eventId || eventId === "") {
            Logger.error("Schedule::setEventTimer() Invalid event id: " + eventId);
            return false;
        }
        Logger.debug("Schedule::setEventTimer() eventId: " + eventId);
        if(this.timers[eventId]) {
            Logger.error("Schedule::setEventTimer() Timer already set for event: " + eventId);
            return false;
        }
        var dateString;
        var date = event["date"];
        if(date && date !== "") {
            dateString = date;
        } else {
            dateString = this.calculateNextDate(event);
        }
        if(!dateString || dateString === "") {
            Logger.error("Schedule::setEventTimer() Invalid dateString: " + dateString);
            return false;
        }
        Logger.debug("Schedule::setEventTimer() Setting event timer: eventId: " + eventId + " date: " + dateString);
        var date = Moment(dateString);
        var ms = date - Date.now();
        if(ms <= 0) {
            Logger.debug("Schedule::setEventTimer() Event past due by " + (-ms) + " milliseconds, executing now: eventId: " + eventId);
            this.executeEvent(eventId);
            return false;
        }
        Logger.debug("Schedule::setEventTimer() Event timer set: eventId: " + eventId + " ms: " + ms);
        this.timers[eventId] = setTimeout(() => {
            this.executeEvent(eventId);
        }, ms);
        return true;
    }

    removeEventTimer(eventId) {
        Logger.debug("Schedule::removeEventTimer() eventId: " + eventId);
        var timer = this.timers[eventId];
        if(!timer) {
            Logger.error("Schedule::removeEventTimer() No timer set for event: " + eventId);
            return;
        }
        delete this.timers[eventId];
        clearTimeout(timer);
    }

    addToSchedule(event) {
        var eventId = event["id"];
        if(!eventId || eventId === "") {
            Logger.error("Schedule::addToSchedule() Invalid event id: " + eventId);
            return false;
        }
        if(this.schedule[eventId]) {
            Logger.error("Schedule::addToSchedule() Event already added to schedule: eventId: " + eventId + " event: ", event);
            return false;
        }
        Logger.debug("Schedule::addToSchedule() eventId: " + eventId + " event: ", event);
        this.schedule[eventId] = event;
        if(!this.setEventTimer(event)) {
            return true;
        }
        FileSystem.writeFileSync(this.scheduleFilePath, JSON.stringify(this.schedule), (error) => {
            if(error) {
                Logger.error("Schedule::addToSchedule() Unable to write schedule file", error);
            }
        });
        return true;
    }

    removeFromSchedule(eventId) {
        if(!this.schedule[eventId]) {
            Logger.error("Schedule::removeFromSchedule() Event not found in schedule: eventId: " + eventId);
            return false;
        }
        Logger.debug("Schedule::removeFromSchedule() eventId: " + eventId);
        this.removeEventTimer(eventId);
        delete this.schedule[eventId];
        FileSystem.writeFileSync(this.scheduleFilePath, JSON.stringify(this.schedule), (error) => {
            if(error) {
                Logger.error("Schedule:removeFromSchedule() Unable to write schedule file", error);
            }
        });
        return true;
    }

    setOverrideCallback(trigger, callback) {
        Logger.debug("Schedule::setOverrideCallback() trigger: " + trigger);
        this.overrideCallbacks[trigger.toUpperCase()] = callback;
    }
};

// Export the classes
module.exports = {

    Schedule : Schedule

};