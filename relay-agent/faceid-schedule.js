/**
 * Face ID terminals handle one ISAPI HTTP call at a time. AcsEvent (pechat)
 * must not run while a photo is waiting to enroll, and must back off after
 * a timeout instead of retrying every second.
 */

function shouldPollStamp(state) {
  if (state.stampEnabled === false) return false;
  if ((state.pendingCount || 0) > 0) return false;
  if (state.coolingDown) return false;
  const now = state.now || Date.now();
  if (now < (state.stampPauseUntil || 0)) return false;
  const every = state.stampEveryMs || 2000;
  if (state.lastStampAt && now - state.lastStampAt < every) return false;
  return true;
}

function stampBackoffMs(consecutiveTimeouts) {
  const n = Math.max(1, Number(consecutiveTimeouts) || 1);
  return Math.min(15_000 * 2 ** (n - 1), 120_000);
}

module.exports = {
  shouldPollStamp,
  stampBackoffMs,
};
