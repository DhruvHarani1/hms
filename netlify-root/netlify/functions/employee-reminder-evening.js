// netlify/functions/employee-reminder-evening.js
// 7:30 PM IST = 14:00 UTC checkout reminder
const { handler: baseHandler } = require('./employee-reminder');
exports.handler = baseHandler;
