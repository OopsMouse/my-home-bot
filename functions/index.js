'use strict';

const functions = require('firebase-functions');
const DialogflowApp = require('actions-on-google').DialogflowApp;
const axios = require('axios');
const messagesJson = require('./messages.json');

const postToIRKit = (message) => {
  const clinetKey = process.env.IRKIT_CLIENTKEY || functions.config().irkit.clientkey || '';
  const deviceid  = process.env.IRKIT_DEVICEID || functions.config().irkit.deviceid || '';
  const messages = Array.isArray(message) ? message : [message];
  const promise = Promise.resolve();
  for (const m of messages) {
    promise.then(() => {
      return axios.post('https://api.getirkit.com/1/messages', {
        clientkey: clinetKey,
        deviceid: deviceid,
        message: JSON.stringify({ message: m })
      });
    });
  }
  return promise;
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
  
  function sendResponse(message) {
    if (!message) {
      response.send();
      return;
    }

    let responseJson = {};
    responseJson.speech = message;
    responseJson.displayText = message;
    
    console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
    response.json(responseJson);
  }
  
  function switchStatus(action, status) {
    const messages = messagesJson[action] || {};
    const message = messages[status.toLowerCase()];
  
    console.log('IRKIT Message: ' + JSON.stringify(message));
  
    postToIRKit(message).then(() => {
      sendResponse();
    }).catch((err) => {
      console.error(err);
      sendResponse(err.message);
    });
  }
  
  function switchChannel(action, channel) {
    const messages = messagesJson[action] || {};
    let message;
    if (!!channel) {
      message = messages[channel.toLowerCase()];
      console.log('IRKIT Message: ' + JSON.stringify(message));
  
      postToIRKit(message).then(() => {
        sendResponse();
      }).catch((err) => {
        console.error(err);
        sendResponse(err.message);
      });
    } else {
      let channelMessages = Object.keys(messages).map(function(key) {
        return messages[key];
      });
      const channelLoop = () => {
        if (channelMessages.length === 0) {
          sendResponse();
          return;
        }
        const message = channelMessages.pop();
  
        console.log('IRKIT Message: ' + JSON.stringify(message));
  
        postToIRKit(message).then(() => {
          setTimeout(channelLoop, 6000);
        }).catch((err) => {
          console.error(err);
          sendResponse(err.message);
        });
      };
      channelLoop();
    }
  }
  
  switch (action) {
    case 'input.aircon.switch':
    case 'input.light.switch':
    case 'input.tv.switch':
      const status = params.status || '';
      switchStatus(action, status);
      break;
    case 'input.tv.channel.switch':
      const channel = params.channel || null;
      switchChannel(action, channel);
      break;
    default:
      sendResponse();
  }
});