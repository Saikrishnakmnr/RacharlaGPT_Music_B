{
  "$id": "6ab0b691d83206496aa9",
  "$createdAt": "2026-09-21T04:46:09.898+00:00",
  "$updatedAt": "2026-09-21T04:46:09.898+00:00",
  "$permissions": [],
  "resourceId": "6ab008f50021be096840",
  "resourceType": "functions",
  "deploymentId": "6ab0b5ee90867856bdeb",
  "trigger": "http",
  "status": "failed",
  "requestMethod": "post",
  "requestPath": "/orders/RM-20260921-44A1F8/files",
  "requestHeaders": [
    {
      "name": "host",
      "value": "racharlagpt-music-b.sgp.appwrite.run"
    },
    {
      "name": "user-agent",
      "value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    },
    {
      "name": "content-length",
      "value": "176108"
    },
    {
      "name": "content-type",
      "value": "audio/webm"
    }
  ],
  "responseStatusCode": 500,
  "responseBody": "",
  "responseHeaders": [
    {
      "name": "content-type",
      "value": "application/json; charset=utf-8"
    }
  ],
  "logs": "",
  "errors": "Error: Appwrite 400: Invalid query: Attribute not found in schema: \n    at aw (file:///usr/local/server/src/function/index.js:106:11)\n    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)\n    at async rows (file:///usr/local/server/src/function/index.js:123:5)\n    at async orderByNo (file:///usr/local/server/src/function/index.js:149:14)\n    at async Module.default (file:///usr/local/server/src/function/index.js:401:17)\n    at async execute (/usr/local/server/src/server.js:295:18)\n    at async action (/usr/local/server/src/server.js:312:9)\n    at async handle (/usr/local/server/src/server.js:95:5)\n    at async Server.<anonymous> (/usr/local/server/src/server.js:67:5)\n",
  "duration": 0.08143806457519531,
  "scheduledAt": null
}
