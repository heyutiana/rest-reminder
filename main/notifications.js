const { Notification } = require('electron');

function showNotification(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, silent: false }).show();
}

module.exports = { showNotification };
