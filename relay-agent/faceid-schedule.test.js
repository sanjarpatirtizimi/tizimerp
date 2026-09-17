const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  shouldPollStamp,
  canTouchDeviceForEnroll,
  stampBackoffMs,
} = require("./faceid-schedule");

describe("shouldPollStamp", () => {
  it("polls pechat even while drivers are waiting to enroll, as long as no enroll write just happened", () => {
    // A non-empty enrollment queue must NOT block pechat for every other
    // driver at this gate for the queue's entire lifetime — only the brief
    // window right around an actual device write matters.
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        pendingCount: 3,
        lastEnrollTouchAt: 0,
        deviceSettleMs: 3_000,
        now: 10_000,
        lastStampAt: 0,
      }),
      true,
    );
  });

  it("skips pechat for a short settle window right after an enroll device write", () => {
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        pendingCount: 1,
        lastEnrollTouchAt: 9_000,
        deviceSettleMs: 3_000,
        now: 10_000,
        lastStampAt: 0,
      }),
      false,
    );
  });

  it("resumes pechat once the settle window has elapsed, even with jobs still pending", () => {
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        pendingCount: 1,
        lastEnrollTouchAt: 5_000,
        deviceSettleMs: 3_000,
        now: 10_000,
        lastStampAt: 0,
      }),
      true,
    );
  });

  it("never blocks on its own most recent stamp touch (would otherwise starve itself)", () => {
    // lastStampAt/stampEveryMs already rate-limit pechat's own cadence;
    // the settle window must only watch the OTHER side (enroll).
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        lastEnrollTouchAt: 0,
        deviceSettleMs: 3_000,
        lastStampAt: 8_000,
        stampEveryMs: 2_000,
        now: 10_000,
      }),
      true,
    );
  });

  it("skips pechat during Face ID enroll cooldown", () => {
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        pendingCount: 0,
        coolingDown: true,
        now: 10_000,
      }),
      false,
    );
  });

  it("skips pechat during timeout backoff", () => {
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        pendingCount: 0,
        stampPauseUntil: 30_000,
        now: 20_000,
      }),
      false,
    );
  });

  it("polls pechat when the queue is empty and the interval elapsed", () => {
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        pendingCount: 0,
        coolingDown: false,
        stampPauseUntil: 0,
        lastStampAt: 1_000,
        stampEveryMs: 2_000,
        now: 3_500,
      }),
      true,
    );
  });

  it("does not poll faster than stampEveryMs", () => {
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        pendingCount: 0,
        lastStampAt: 1_000,
        stampEveryMs: 2_000,
        now: 2_500,
      }),
      false,
    );
  });
});

describe("canTouchDeviceForEnroll", () => {
  it("refuses an enroll write while still inside the settle window from a recent pechat poll", () => {
    assert.equal(
      canTouchDeviceForEnroll({
        lastStampTouchAt: 9_000,
        deviceSettleMs: 3_000,
        now: 10_000,
      }),
      false,
    );
  });

  it("allows an enroll write once the settle window has elapsed", () => {
    assert.equal(
      canTouchDeviceForEnroll({
        lastStampTouchAt: 5_000,
        deviceSettleMs: 3_000,
        now: 10_000,
      }),
      true,
    );
  });

  it("allows an enroll write when pechat has never touched the device", () => {
    assert.equal(
      canTouchDeviceForEnroll({
        lastStampTouchAt: 0,
        deviceSettleMs: 3_000,
        now: 10_000,
      }),
      true,
    );
  });
});

describe("regression: stuck enroll queue must not starve pechat forever", () => {
  it("still lets pechat fire regularly across a 5-minute window with a permanently-stuck enroll job", () => {
    // This is exactly the reported bug: a haydovchi (driver) enrollment
    // keeps failing (bad network / slow Face ID) and never leaves the
    // queue. Under the OLD logic (`pendingCount > 0` => never poll pechat)
    // this loop would report zero pechat attempts. Under the fix, pechat
    // should fire roughly once every stampEveryMs the whole time, since the
    // queue merely being non-empty must not matter.
    const stampEveryMs = 2_000;
    const deviceSettleMs = 3_000;
    let lastStampAt = 0;
    let lastEnrollTouchAt = 0; // the stuck job never actually completes a device write again
    let stampAttempts = 0;

    for (let now = 0; now <= 5 * 60 * 1000; now += 500) {
      if (
        shouldPollStamp({
          stampEnabled: true,
          pendingCount: 1, // one driver permanently stuck in the enroll queue
          coolingDown: false,
          lastEnrollTouchAt,
          deviceSettleMs,
          stampPauseUntil: 0,
          lastStampAt,
          stampEveryMs,
          now,
        })
      ) {
        stampAttempts += 1;
        lastStampAt = now;
      }
    }

    // 5 minutes / 2s ≈ 150 attempts; allow slack for the settle window.
    assert.ok(
      stampAttempts > 100,
      `expected pechat to fire well over 100 times in 5 minutes, got ${stampAttempts}`,
    );
  });

  it("the old pendingCount>0 gate would have produced zero pechat attempts (sanity check on the bug itself)", () => {
    const legacyShouldPollStamp = (state) => {
      if (state.stampEnabled === false) return false;
      if ((state.pendingCount || 0) > 0) return false;
      if (state.coolingDown) return false;
      const now = state.now || Date.now();
      if (now < (state.stampPauseUntil || 0)) return false;
      const every = state.stampEveryMs || 2000;
      if (state.lastStampAt && now - state.lastStampAt < every) return false;
      return true;
    };
    let attempts = 0;
    for (let now = 0; now <= 5 * 60 * 1000; now += 500) {
      if (
        legacyShouldPollStamp({
          stampEnabled: true,
          pendingCount: 1,
          coolingDown: false,
          stampPauseUntil: 0,
          lastStampAt: 0,
          stampEveryMs: 2_000,
          now,
        })
      ) {
        attempts += 1;
      }
    }
    assert.equal(attempts, 0);
  });
});

describe("stampBackoffMs", () => {
  it("grows 15s → 30s → 60s → 120s cap", () => {
    assert.equal(stampBackoffMs(1), 15_000);
    assert.equal(stampBackoffMs(2), 30_000);
    assert.equal(stampBackoffMs(3), 60_000);
    assert.equal(stampBackoffMs(4), 120_000);
    assert.equal(stampBackoffMs(8), 120_000);
  });
});
