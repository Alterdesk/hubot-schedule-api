# Hubot Schedule API

Library to trigger and schedule events and add a REST API to Hubot

## REST API

* protocol - http or https(if certificate file is configured)
* host - URL or ip-address
* port - Configured port number(default 8080)

{protocol}://{host}:{port} -> {api_destination}

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

Example request body
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

returns scheduled event id
```json
{"id":"{event_id}"}
```

### Schedule event in groupchat
POST: *{api_destination}/groupchats/{groupchat_id}/schedule*

Example request body
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

returns scheduled event id
```json
{"id":"{event_id}"}
```

### Retrieve scheduled event in conversation
GET: *{api_destination}/conversations/{conversation_id}/schedule/{event_id}*

returns event data
```json

```

### Retrieve scheduled event in groupchat
GET: *{api_destination}/groupchats/{groupchat_id}/schedule/{event_id}*

returns event data
```json

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

## CommandAndControl class

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
* answers *(Answers)* - Optional pre-filled Answers instance

returns *(String)* - Id of scheduled event

### scheduleEventInMs(chatId, isGroup, userId, command, ms, answers)
Schedule an event for a user in a chat with a command and optional pre-filled Answers in a given number milliseconds
* chatId *(String)* - Chat id where the command is scheduled in
* isGroup *(Boolean)* - If the chat is a groupchat or one-to-one chat
* userId *(String)* - User id to schedule command for
* command *(String)* - Command to schedule
* ms *(Integer)* - Milliseconds to 
* answers *(Answers)* - Optional pre-filled Answers instance

returns *(String)* - Id of scheduled event

### removeFromSchedule(eventId)
Remove a previously scheduled event by id
* eventId *(String)* - Event id to remove

### setOverrideCallback(command, callback)
Set an override callback for a command
* command *(String)* - Command to set the override callback for
* callback *(Function(chatId, isGroup, userId, answers))* - Function callback called when the command is executed
  * chatId *(String)* - Chat id where the command is called in
  * isGroup *(Boolean)* - If the chat is a groupchat or one-to-one chat
  * userId *(String)* - User id the command is called for
  * answers *(Answers)* - Pre-filled Answers instance(may be null)