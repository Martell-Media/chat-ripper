const storage = {};

globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, cb) => {
        if (typeof keys === "string") keys = [keys];
        const result = {};
        for (const k of keys) {
          if (k in storage) result[k] = storage[k];
        }
        if (cb) cb(result);
        return Promise.resolve(result);
      }),
      set: vi.fn((items, cb) => {
        Object.assign(storage, items);
        if (cb) cb();
        return Promise.resolve();
      }),
    },
    session: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn(() => ({
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
      postMessage: vi.fn(),
    })),
    lastError: null,
  },
};

// Reset storage between tests
beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
  vi.clearAllMocks();
});
