# Hubot Schedule API

Library to trigger and schedule events and add a REST API to Hubot

## REST API

* protocol - http or https(if certificate file is configured)
* host - URL or ip-address
* port - Configured port number(default 8080)

{protocol}://{host}:{port}

## Trigger event

POST:
* */conversations/{conversation_id}/trigger*
* */groupchats/{groupchat_id}/trigger*

## Schedule event

POST:
* */conversations/{conversation_id}/schedule*
* */groupchats/{groupchat_id}/schedule*

## Retrieve scheduled event

GET:
* */conversations/{conversation_id}/schedule/{event_id}*
* */groupchats/{groupchat_id}/schedule/{event_id}*

## Delete scheduled event

DELETE:
* */conversations/{conversation_id}/schedule/{event_id}*
* */groupchats/{groupchat_id}/schedule/{event_id}*
