// Mock axios BEFORE importing apiCall so we capture the registered interceptor.
const captured = { onFulfilled: null, onRejected: null };

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    interceptors: {
      response: {
        use: (ok, err) => {
          captured.onFulfilled = ok;
          captured.onRejected = err;
        },
      },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// Stub sibling modules apiCall imports at load time — avoid pulling openai/crypto.
jest.mock("../../constants/apiurl", () => ({ API_BASE_URL: "http://test" }));
jest.mock("../../constants", () => ({ ERROR_MESSAGES: {} }));
jest.mock("openai/core", () => ({ debug: () => {} }));
jest.mock("../../common-functions", () => ({ Decrypt: (x) => x }));

const {
  onSessionExpired,
  clearSessionExpiredCallback,
} = require("../apiCall");

describe("apiCall — 401 session-expired interceptor", () => {
  beforeEach(() => {
    clearSessionExpiredCallback();
  });

  test("interceptor is registered on module load", () => {
    expect(typeof captured.onRejected).toBe("function");
    expect(typeof captured.onFulfilled).toBe("function");
  });

  test("onFulfilled passes response through untouched", () => {
    const res = { status: 200, data: { ok: true } };
    expect(captured.onFulfilled(res)).toBe(res);
  });

  test("callback fires on 401 from own API", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);

    const error = {
      response: { status: 401 },
      config: { url: "http://test/v1/me" },
    };
    await expect(captured.onRejected(error)).rejects.toBe(error);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("callback does NOT fire on non-401 errors", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);

    for (const status of [400, 403, 404, 500, 502]) {
      await expect(
        captured.onRejected({
          response: { status },
          config: { url: "http://test/v1/me" },
        })
      ).rejects.toBeDefined();
    }
    expect(cb).not.toHaveBeenCalled();
  });

  test("callback does NOT fire when response missing (network error)", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);

    await expect(
      captured.onRejected({ message: "Network Error" })
    ).rejects.toBeDefined();
    expect(cb).not.toHaveBeenCalled();
  });

  test("clearSessionExpiredCallback stops further callback firing", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);
    clearSessionExpiredCallback();

    await expect(
      captured.onRejected({
        response: { status: 401 },
        config: { url: "http://test/v1/me" },
      })
    ).rejects.toBeDefined();
    expect(cb).not.toHaveBeenCalled();
  });

  test("onSessionExpired replaces previous callback (last-writer-wins)", async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    onSessionExpired(cb1);
    onSessionExpired(cb2);

    await expect(
      captured.onRejected({
        response: { status: 401 },
        config: { url: "http://test/v1/me" },
      })
    ).rejects.toBeDefined();
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  test("401 from non-API host (S3 signed URL) does NOT fire callback", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);
    await expect(
      captured.onRejected({
        response: { status: 401 },
        config: { url: "https://s3.amazonaws.com/bucket/file.jpg" },
      })
    ).rejects.toBeDefined();
    expect(cb).not.toHaveBeenCalled();
  });

  test("401 from Google/OpenAI/third-party host does NOT fire callback", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);
    for (const url of [
      "https://googleapis.com/photoslibrary/v1/...",
      "https://api.openai.com/v1/chat/completions",
      "https://fonts.googleapis.com/css2",
    ]) {
      await expect(
        captured.onRejected({ response: { status: 401 }, config: { url } })
      ).rejects.toBeDefined();
    }
    expect(cb).not.toHaveBeenCalled();
  });

  test("401 from API_BASE_URL fires callback", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);
    await expect(
      captured.onRejected({
        response: { status: 401 },
        config: { url: "http://test/v1/me" },
      })
    ).rejects.toBeDefined();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("401 from relative URL (no protocol) fires callback — axios prepends baseURL", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);
    await expect(
      captured.onRejected({
        response: { status: 401 },
        config: { url: "/v1/customer/login" },
      })
    ).rejects.toBeDefined();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("401 with no config.url does NOT fire (can't classify safely)", async () => {
    const cb = jest.fn();
    onSessionExpired(cb);
    await expect(
      captured.onRejected({ response: { status: 401 } })
    ).rejects.toBeDefined();
    expect(cb).not.toHaveBeenCalled();
  });
});
