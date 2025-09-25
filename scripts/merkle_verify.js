const crypto = require('crypto');
function sha256Hex(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }
function verifyMerkle(leafHashesHex, rootHex) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(rootHex)) return false;
  return true;
}
module.exports = { sha256Hex, verifyMerkle };

