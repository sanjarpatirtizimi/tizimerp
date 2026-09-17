/**
 * Face ID terminals handle one ISAPI HTTP call at a time, so AcsEvent
 * (pechat) and an enrollment write must never be sent in the very same
 * instant, and pechat must back off after a timeout instead of retrying
 * every second.
 *
 * IMPORTANT: pechat is gated on `lastEnrollTouchAt` — a short "let the
 * terminal breathe" window right after an actual enroll device write — NOT
 * on whether the enrollment queue is empty. A driver waiting in the queue
 * (or stuck there on a network hiccup) must not block pechat for every
 * other driver at this gate for the queue's entire lifetime; it only needs
 * to avoid overlapping the few seconds a real ISAPI write is in flight.
 * Symmetrically, an enroll write is gated on `lastStampTouchAt` so it does
 * not fire in the same instant as a pechat AcsEvent call either. Each side
 * only watches the OTHER side's last touch — a side must never block its
 * own next poll via its own most recent touch, or it would starve itself.
 */

function shouldPollStamp(state) {
  if (state.stampEnabled === false) return false;
  if (state.coolingDown) return false;
  const now = state.now || Date.now();
  const settleMs = state.deviceSettleMs || 0;
  if (now - (state.lastEnrollTouchAt || 0) < settleMs) return false;
  if (now < (state.stampPauseUntil || 0)) return false;
  const every = state.stampEveryMs || 2000;
  if (state.lastStampAt && now - state.lastStampAt < every) return false;
  return true;
}

/** Same "let the terminal breathe" guard, checked before an enroll write. */
function canTouchDeviceForEnroll(state) {
  const now = state.now || Date.now();
  const settleMs = state.deviceSettleMs || 0;
  return now - (state.lastStampTouchAt || 0) >= settleMs;
}

function stampBackoffMs(consecutiveTimeouts) {
  const n = Math.max(1, Number(consecutiveTimeouts) || 1);
  return Math.min(15_000 * 2 ** (n - 1), 120_000);
}

module.exports = {
  shouldPollStamp,
  canTouchDeviceForEnroll,
  stampBackoffMs,
};
