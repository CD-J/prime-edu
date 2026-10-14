const { invokeNetlifyHandler } = require("./_netlify-adapter");

module.exports = (req, res) => invokeNetlifyHandler(req, res, "../netlify/functions/generateLearningDiagnosis.mjs");
