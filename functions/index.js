'use strict';

const functions = require('firebase-functions');
const DialogflowApp = require('actions-on-google').DialogflowApp;
const axios = require('axios');
const messagesJson = require('./messages.json');

const postToIRKit = (message) => {
  const clinetKey = process.env.IRKIT_CLIENTKEY || functions.config().irkit.clientkey || '';
  const deviceid  = process.env.IRKIT_DEVICEID || functions.config().irkit.deviceid || '';
  return axios.post('https://api.getirkit.com/1/messages', {
    clientkey: clinetKey,
    deviceid: deviceid,
    message: JSON.stringify(message)
  });
};

exports.processHandler = functions.https.onRequest((request, response) => {
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
  console.log('Dialogflow Query Result: ' + JSON.stringify(request.body.queryResult));
  console.log('Dialogflow Action: ' + JSON.stringify(request.body.queryResult.action));

  let action = (request.body.queryResult.action) ? request.body.queryResult.action : 'default';
  let params = request.body.queryResult.parameters || {};
  // let ctx = request.body.result.contexts;
  // let source = (request.body.originalDetectIntentRequest) ? request.body.originalDetectIntentRequest.source : undefined;
  // let session = (request.body.session) ? request.body.session : undefined;
  
  const status = params.status || '';
  const messages = messagesJson[action] || {};
  const message = messages[status.toLowerCase()];
 
  if (!status || status.length === 0 || !message) {
    return sendResponse("認識できませんでした。");
  }
  
  console.log('IRKIT Message: ' + JSON.stringify(message));
  
  function sendResponse(message) {
    let responseJson = {};
    responseJson.speech = message;
    responseJson.displayText = message;
  
    console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
    response.json(responseJson);
  }
  
  postToIRKit(message).then(() => {
    sendResponse("了解しました。");
  }).catch((err) => {
    console.error(err);
    sendResponse(err.message);
  });
});