import { describe, expect, it } from "vitest";
import { formatErrorMessage } from "./errorMessages";
import { ApiClientError } from "./types";

describe("formatErrorMessage", () => {
  it("uses API message overrides before the default API fallback", () => {
    expect(
      formatErrorMessage(new ApiClientError("conflict", 409), {
        apiClientMessages: {
          conflict: "数据冲突，请刷新后重试。",
        },
      }),
    ).toBe("数据冲突，请刷新后重试。");
  });

  it("uses API status overrides before message overrides", () => {
    expect(
      formatErrorMessage(new ApiClientError("conflict", 403), {
        apiClientStatusMessages: {
          403: "当前账号没有执行该操作的权限。",
        },
        apiClientMessages: {
          conflict: "数据冲突，请刷新后重试。",
        },
      }),
    ).toBe("当前账号没有执行该操作的权限。");
  });

  it("keeps native Error messages by default", () => {
    expect(formatErrorMessage(new Error("network failed"))).toBe("network failed");
  });

  it("can suppress native Error messages for fixed user-facing fallbacks", () => {
    expect(formatErrorMessage(new Error("internal detail"), { fallback: "操作失败，请稍后重试。", includeNativeErrorMessage: false })).toBe(
      "操作失败，请稍后重试。",
    );
  });
});
