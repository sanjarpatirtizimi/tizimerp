const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { shouldPollStamp, stampBackoffMs } = require("./faceid-schedule");

describe("shouldPollStamp", () => {
  it("skips pechat while a driver is waiting to enroll", () => {
    assert.equal(
      shouldPollStamp({
        stampEnabled: true,
        pendingCount: 1,
        now: 10_000,
        lastStampAt: 0,
      }),
      false,
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

describe("stampBackoffMs", () => {
  it("grows 15s → 30s → 60s → 120s cap", () => {
    assert.equal(stampBackoffMs(1), 15_000);
    assert.equal(stampBackoffMs(2), 30_000);
    assert.equal(stampBackoffMs(3), 60_000);
    assert.equal(stampBackoffMs(4), 120_000);
    assert.equal(stampBackoffMs(8), 120_000);
  });
});
