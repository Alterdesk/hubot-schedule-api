# Hubot Schedule API

Library to trigger and schedule events and add a REST API to Hubot

## REST API

This library adds a basic JSON REST API to the Hubot instance for processing HTTP requests. The library can use the 
internal Hubot HTTP server or use a separate HTTP or HTTPS server(see the [environment variables](#Environment variables)).

For authentication the HTTP requests need to use an Authorization header with a token which needs to be configured with 
a [environment variable](#Environment variables).

Request url to the API starts with {protocol}://{host}:{port} abbreviated as {api_destination} below.
* protocol - http or https(if certificate file is configured)
* host - URL or ip-address
* port - Configured port number(Hubot server default 8080, separate server default 8443)

Example curl request, triggering a command on the local machine using defaults
```bash
curl \
 --header "Authorization: {api_token}" \
 --header "content-Type: application/json; charset=UTF-8" \
 --data "{\"command\":\"introduce\"}" \
 http://127.0.0.1:8080/conversations/{conversation_id}/trigger
```

### Trigger event in conversation 
POST: *{api_destination}/conversations/{conversation_id}/trigger*

Example request body
```json
{
    "command":"welcome",
    "answers":{
        "key_one":"value_one",
        "key_two":"value_two"
    }
}
```
* command - Command to trigger
* answers - Pre-filled answers to use *(Optional)*

returns if successful
```json
{"success":"true"}
```

### Trigger event in groupchat

POST: *{api_destination}/groupchats/{groupchat_id}/trigger*

Example request body
```json
{
    "user_id":"{user_id}",
    "command":"welcome",
    "answers":{
        "key_one":"value_one",
        "key_two":"value_two"
    }
}
```
* user_id - User id to trigger command for *(Only used for groupchats)*
* command - Command to trigger
* answers - Pre-filled answers to use *(Optional)*

returns if successful
```json
{"success":"true"}
```

### Schedule event in conversation
POST: *{api_destination}/conversations/{conversation_id}/schedule*

Example request body for one-time event
```json
{
    "date":"2018-07-17T07:35:00Z",
    "command":"welcome",
    "answers":{
        "key_one":"value_one",
        "key_two":"value_two"
    }
}
```
* date - UTC Timestamp to schedule command *(YYYY-MM-DDTHH:mm:ssZ)*
* command - Command to trigger
* answers - Pre-filled answers to use *(Optional)*

Example request body for repeated event
```json
{
    "times":["08:00","15:00"],
    "week_days":[1,6,7],
    "exclude_dates":["2018-10-04","2018-12-25"],
    "command":"checkup",
    "answers":{
        "key_one":"value_one",
        "key_two":"value_two"
    }
}
```
* times - UTC times array to schedule command *(HH:mm:ss)*
* week_days - Integer array of days to schedule *(Optional, 1=monday, 7=sunday)*
* exclude_dates - Array of dates to exclude from schedule *(Optional, YYYY-MM-DD)*
* command - Command to trigger
* answers - Pre-filled answers to use *(Optional)*

returns scheduled event id
```json
{"id":"{event_id}"}
```

### Schedule event in groupchat
POST: *{api_destination}/groupchats/{groupchat_id}/schedule*

Example request body for one-time event
```json
{
    "user_id":"{user_id}",
    "date":"2018-07-17T07:35:00Z",
    "command":"welcome",
    "answers":{
        "key_one":"value_one",
        "key_two":"value_two"
    }
}
```
* user_id - User id to trigger command for
* date - UTC Timestamp to schedule command *(YYYY-MM-DDTHH:mm:ssZ)*
* command - Command to trigger
* answers - Pre-filled answers to use *(Optional)*

Example request body for repeated event
```json
{
    "user_id":"{user_id}",
    "times":["08:00","15:00"],
    "week_days":[1,6,7],
    "exclude_dates":["2018-10-04","2018-12-25"],
    "command":"checkup",
    "answers":{
        "key_one":"value_one",
        "key_two":"value_two"
    }
}
```
* user_id - User id to trigger command for
* times - UTC times array to schedule command *(HH:mm:ss)*
* week_days - Integer array of days to schedule *(Optional, 1=monday, 7=sunday)*
* exclude_dates - Array of dates to exclude from schedule *(Optional, YYYY-MM-DD)*
* command - Command to trigger
* answers - Pre-filled answers to use *(Optional)*

returns scheduled event id
```json
{"id":"{event_id}"}
```

### Retrieve scheduled event in conversation
GET: *{api_destination}/conversations/{conversation_id}/schedule/{event_id}*

returns event data
```json
{
    "chat_id":"{conversation_id}",
    "is_groupchat":false,
    "date":"2018-07-19T10:00:00Z",
    "command":"introduce",
    "answers":{
        "time_of_day":"morning"
    }
}
```

### Retrieve scheduled event in groupchat
GET: *{api_destination}/groupchats/{groupchat_id}/schedule/{event_id}*

returns event data
```json
{
    "chat_id":"{groupchat_id}",
    "is_groupchat":true,
    "user_id":"{user_id}",
    "date":"2018-07-19T12:45:00Z",
    "command":"introduce",
    "answers":{
        "time_of_day":"afternoon"
    }
}
```

### Delete scheduled event in conversation
DELETE: *{api_destination}/conversations/{conversation_id}/schedule/{event_id}*

returns if successful
```json
{"success":"true"}
```

### Delete scheduled event in groupchat
DELETE: *{api_destination}/groupchats/{groupchat_id}/schedule/{event_id}*

returns if successful
```json
{"success":"true"}
```

## Schedule class

### constructor(robot)
Create a new CommandAndControl instance
* robot *(Robot)* - Hubot Robot instance to add REST API and scheduling to

### scheduleEvent(chatId, isGroup, userId, command, date, answers)
Schedule an event by date for a user in a chat with a command and optional pre-filled Answers
* chatId *(String)* - Chat id where the command is scheduled in
* isGroup *(Boolean)* - If the chat is a groupchat or one-to-one chat
* userId *(String)* - User id to schedule command for
* command *(String)* - Command to schedule
* date *(String)* - UTC Timestamp to schedule command *(YYYY-MM-DDTHH:mm:ssZ)*
* answers *(Answers)* - Pre-filled Answers instance *(Optional)*

returns *(String)* - Id of scheduled event

### scheduleEventInMs(chatId, isGroup, userId, command, ms, answers)
Schedule an event for a user in a chat with a command and optional pre-filled Answers in a given number milliseconds
* chatId *(String)* - Chat id where the command is scheduled in
* isGroup *(Boolean)* - If the chat is a groupchat or one-to-one chat
* userId *(String)* - User id to schedule command for
* command *(String)* - Command to schedule
* ms *(Integer)* - Milliseconds to 
* answers *(Answers)* - Pre-filled Answers instance *(Optional)*

returns *(String)* - Id of scheduled event

### scheduleRepeatedEvent(chatId, isGroup, userId, command, times, days, excludes, answers)
* chatId *(String)* - Chat id where the command is scheduled in
* isGroup *(Boolean)* - If the chat is a groupchat or one-to-one chat
* userId *(String)* - User id to schedule command for
* command *(String)* - Command to schedule
* times *(Array)* - Array of UTC times to schedule command *(HH:mm:ss)*
* days *(Array)* - Integer array of days to schedule *(Optional, 1=monday, 7=sunday)*
* excludes *(Array)* - Array of dates to exclude from schedule *(Optional, YYYY-MM-DD)*
* answers *(Answers)* - Pre-filled Answers instance *(Optional)*

### removeFromSchedule(eventId)
Remove a previously scheduled event by id
* eventId *(String)* - Event id to remove

returns *(Boolean)* If removal was successful

### setOverrideCallback(command, callback)
Set an override callback for a command
* command *(String)* - Command to set the override callback for
* callback *(Function(chatId, isGroup, userId, answers))* - Function callback called when the command is executed
  * chatId *(String)* - Chat id where the command is called in
  * isGroup *(Boolean)* - If the chat is a groupchat or one-to-one chat
  * userId *(String)* - User id the command is called for
  * answers *(Answers)* - Pre-filled Answers instance *(Optional)*
  
## Environment variables
Schedule API log level
* HUBOT_SCHEDULE_API_LOG_LEVEL

HUBOT_SCHEDULE_API_TOKEN
* Token to check API requests with, using a UUID is recommended

HUBOT_SCHEDULE_API_SERVER
* Use separate HTTP(S) server(on) or default Hubot HTTP server(off) *(0 = off, 1 = on, default: 0)*

HUBOT_SCHEDULE_API_PORT
* Port to listen to, only with separate server *(default 8443)*

HUBOT_SCHEDULE_API_HOST
* Host to listen to, only with separate server *(default 0.0.0.0)*

HUBOT_SCHEDULE_API_KEY_PATH
* Filepath to pem private key file, only with separate server

HUBOT_SCHEDULE_API_CERT_PATH
* Filepath to pem certificate file, only with separate server

HUBOT_SCHEDULE_API_CERT_PASS
* Passphrase for certificate, only with separate server

## Generate own certificate
```bash
openssl req -x509 -newkey rsa:4096 -keyout privatekey.pem -out certificate.pem -days 365 -subj '/CN=localhost'
```