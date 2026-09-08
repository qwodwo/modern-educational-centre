'use strict';

// SMS notifications are stubbed for Phase 4.
// Wire a real provider (e.g. Africa's Talking, Express Pay, Twilio) here and
// return true once the message is accepted.

function send(message) {
  return Promise.resolve(false).then((sent) => {
    console.log('[sms] (stub) would send: ' + (message || '').substring(0, 80));
    return sent;
  });
}

module.exports = { send };