const { invokeNetlifyHandler } = require('./_netlify-adapter');
module.exports = (req,res) => invokeNetlifyHandler(req,res,() => import('../netlify/functions/gradeFeedback.mjs'));
