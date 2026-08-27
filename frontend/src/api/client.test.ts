import { beforeEach, describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  clearStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredTokens,
} from "./client";

describe("auth token storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores access and refresh tokens", () => {
    setStoredTokens({ access_token: "access-123", refresh_token: "refresh-456" });

    expect(getStoredAccessToken()).toBe("access-123");
    expect(getStoredRefreshToken()).toBe("refresh-456");
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe("access-123");
    expect(window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe("refresh-456");
  });

  it("clears stored tokens", () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, "token");
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, "refresh");

    clearStoredTokens();

    expect(getStoredAccessToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });
});
