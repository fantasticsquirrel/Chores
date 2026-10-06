const fs = require('node:fs');
const path = require('node:path');

// Firebase's client configuration stays outside Git. This is not the FCM v1
// server/service-account credential; that must be provisioned separately in EAS.
module.exports = ({ config }) => {
  const supplied = process.env.GOOGLE_SERVICES_JSON;
  if (!supplied) return config;
  const file = path.resolve(supplied);
  let firebase;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error();
    firebase = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error('Firebase configuration is unavailable or invalid.');
  }
  const matches = Array.isArray(firebase.client) && firebase.client.some(client =>
    client?.client_info?.android_client_info?.package_name === config.android?.package);
  if (!matches || !firebase.project_info?.project_id) {
    throw new Error('Firebase configuration does not match the Android application.');
  }
  return { ...config, android: { ...config.android, googleServicesFile: file } };
};
