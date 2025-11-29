const Joi = require('joi');

const createGameSchema = Joi.object({
  playerName: Joi.string().trim().min(1).max(20).required(),
});

const joinGameSchema = Joi.object({
  sessionId: Joi.string().length(6).required(),
  playerName: Joi.string().trim().min(1).max(20).required(),
});

const submitQuestionSchema = Joi.object({
  question: Joi.string().trim().min(1).max(200).required(),
  answer: Joi.string().trim().min(1).max(50).required(),
});

const submitGuessSchema = Joi.object({
  guess: Joi.string().trim().min(1).max(50).required(),
});

module.exports = {
  createGameSchema,
  joinGameSchema,
  submitQuestionSchema,
  submitGuessSchema,
};