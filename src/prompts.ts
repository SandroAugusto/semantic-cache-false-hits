/**
 * Judge prompts.
 *
 * "plain" only defines the task. "guided" also names the kinds of change that alter
 * meaning. Those kinds are the hard-negative categories of this dataset, so the guided
 * prompt is tuned to the test set: treat its scores as an upper bound, not a fair estimate.
 */
const TASK =
  'You check whether a cached answer can be reused. You receive two questions a user might ask ' +
  'an assistant about a clinical trial. Decide whether one single correct answer would fully and ' +
  'correctly answer both questions. Reply only with JSON: {"same": true} or {"same": false}.';

const GUIDANCE =
  ' Different wording of the same request counts as the same. Any change in meaning makes them ' +
  'different, even when most words are shared: a negation, who does what to whom, a different ' +
  'number, a different named entity, or a narrower or wider scope.';

/** Same task as "plain", worded for patients' health questions (used with the MQP dataset). */
const HEALTH_TASK =
  'You check whether a cached answer can be reused. You receive two questions a patient might ask ' +
  'a doctor. Decide whether one single correct answer would fully and correctly answer both ' +
  'questions. Reply only with JSON: {"same": true} or {"same": false}.';

export const PROMPTS: Record<string, string> = {
  plain: TASK,
  guided: TASK + GUIDANCE,
  health: HEALTH_TASK,
};
