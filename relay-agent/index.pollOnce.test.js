const { describe, it, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const {
  pollOnce,
  enrollCooldownUntil,
  enrollFailureCount,
  MAX_TRANSIENT_ENROLL_RETRIES,
  STUCK_QUEUE_MAX_AGE_MS,
} = require("./index");

const originalAxiosGet = axios.get;

function fakeApi({ jobs = [], onAck } = {}) {
  const calls = { ack: [], clear: [] };
  return {
    calls,
    get: async () => ({ data: jobs }),
    post: async (url, body) => {
      if (url.endsWith("/pending/clear")) {
        calls.clear.push({ url, body });
        return { data: { clearedJobs: jobs.length, removedDrivers: 0 } };
      }
      calls.ack.push({ url, body });
      onAck?.(url, body);
      return { data: {} };
    },
  };
}

function transientError() {
  const error = new Error("timeout of 20000ms exceeded");
  error.code = "ETIMEDOUT";
  return error;
}

describe("pollOnce — device settle window + stuck-job handling", () => {
  beforeEach(() => {
    enrollCooldownUntil.clear();
    enrollFailureCount.clear();
  });

  after(() => {
    axios.get = originalAxiosGet;
  });

  it("does not touch the device (or the queue) when a pechat poll just happened", async () => {
    let axiosGetCalled = false;
    axios.get = async () => {
      axiosGetCalled = true;
      throw new Error("should not be called");
    };

    const api = fakeApi({
      jobs: [
        {
          registrationId: "reg-settle",
          driverId: "drv-1",
          employeeNo: "drv-1",
          fullName: "Test Driver",
          photoUrl: "/photo",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await pollOnce(api, {}, "http://backend", "device-1", {
      canTouchDevice: false,
    });

    assert.deepEqual(result, {
      pendingCount: 1,
      coolingDown: false,
      deviceTouched: false,
    });
    assert.equal(axiosGetCalled, false);
    assert.equal(api.calls.ack.length, 0);
  });

  it("gives up on a job after MAX_TRANSIENT_ENROLL_RETRIES consecutive timeouts instead of blocking the gate forever", async () => {
    axios.get = async () => {
      throw transientError();
    };
    enrollFailureCount.set("reg-stuck", MAX_TRANSIENT_ENROLL_RETRIES - 1);

    const api = fakeApi({
      jobs: [
        {
          registrationId: "reg-stuck",
          driverId: "drv-2",
          employeeNo: "drv-2",
          fullName: "Stuck Driver",
          photoUrl: "/photo",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await pollOnce(api, {}, "http://backend", "device-1", {
      canTouchDevice: true,
    });

    assert.equal(result.deviceTouched, true);
    assert.equal(result.coolingDown, false, "must stop cooling down the gate once the job is dropped");
    assert.equal(result.pendingCount, 0);
    assert.equal(api.calls.ack.length, 1);
    assert.equal(api.calls.ack[0].body.success, false);
    assert.match(api.calls.ack[0].body.error, /ketma-ket/);
    assert.equal(enrollFailureCount.has("reg-stuck"), false);
    assert.equal(enrollCooldownUntil.has("reg-stuck"), false);
  });

  it("keeps retrying (without acking FAILED) below the consecutive-failure threshold", async () => {
    axios.get = async () => {
      throw transientError();
    };

    const api = fakeApi({
      jobs: [
        {
          registrationId: "reg-retry",
          driverId: "drv-3",
          employeeNo: "drv-3",
          fullName: "Retrying Driver",
          photoUrl: "/photo",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await pollOnce(api, {}, "http://backend", "device-1", {
      canTouchDevice: true,
    });

    assert.equal(result.deviceTouched, true);
    assert.equal(result.coolingDown, true);
    assert.equal(api.calls.ack.length, 0, "must not give up before the retry limit");
    assert.equal(enrollFailureCount.get("reg-retry"), 1);
    assert.ok(enrollCooldownUntil.has("reg-retry"));
  });

  it("clears the queue when the oldest job is stuck far longer than any real attempt should take, even with pendingCount well under the size threshold", async () => {
    const api = fakeApi({
      jobs: [
        {
          registrationId: "reg-old",
          driverId: "drv-4",
          employeeNo: "drv-4",
          fullName: "Very Old Job",
          photoUrl: "/photo",
          createdAt: new Date(
            Date.now() - STUCK_QUEUE_MAX_AGE_MS - 60_000,
          ).toISOString(),
        },
      ],
    });

    const result = await pollOnce(api, {}, "http://backend", "device-1", {
      canTouchDevice: true,
    });

    assert.equal(result.deviceTouched, false);
    assert.equal(result.pendingCount, 1);
    assert.equal(
      api.calls.clear.length,
      1,
      "expected the age-based safety net to trigger a queue clear despite pendingCount=1",
    );
  });
});
