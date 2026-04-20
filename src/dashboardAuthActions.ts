import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import { sleep } from "./dashboardClient";
import type { PendingTaskMutation } from "./dashboardControlTypes";
import type {
  AuthConfig,
  CopyState,
  DeviceLoginSession,
  Locale,
  NoticeTone,
} from "./dashboardTypes";

type DashboardRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

type DashboardAuthActionsInput = {
  locale: Locale;
  authConfig: AuthConfig | null;
  deviceLogin: DeviceLoginSession | null;
  api: DashboardRequest;
  refreshAll: () => Promise<void>;
  pollTokenRef: MutableRefObject<number>;
  setSessionToken: (next: string) => void;
  setPendingTaskMutations: Dispatch<SetStateAction<Record<string, PendingTaskMutation>>>;
  setDeviceLogin: Dispatch<SetStateAction<DeviceLoginSession | null>>;
  setCopyState: (next: CopyState) => void;
  setTransientNotice: (message: string, tone?: NoticeTone) => void;
  summarizeError: (error: unknown) => string;
};

export function createDashboardAuthActions(input: DashboardAuthActionsInput) {
  const {
    locale,
    authConfig,
    deviceLogin,
    api,
    refreshAll,
    pollTokenRef,
    setSessionToken,
    setPendingTaskMutations,
    setDeviceLogin,
    setCopyState,
    setTransientNotice,
    summarizeError,
  } = input;

  async function pollDeviceLogin(session: DeviceLoginSession, pollToken: number) {
    while (Date.now() < session.expiresAt) {
      if (pollToken !== pollTokenRef.current) return;
      await sleep(session.intervalSec * 1000);
      try {
        const polled = await api<{
          sessionToken?: string;
          error?: string;
          error_description?: string;
        }>("/api/auth/device/poll", {
          method: "POST",
          body: JSON.stringify({ deviceCode: session.deviceCode }),
        });

        if (polled.sessionToken) {
          localStorage.setItem("codex.sessionToken", polled.sessionToken);
          setSessionToken(polled.sessionToken);
          setDeviceLogin((prev) =>
            prev
              ? {
                  ...prev,
                  status: locale === "zh-CN" ? "登录成功，正在刷新界面..." : "Signed in. Refreshing dashboard...",
                }
              : prev,
          );
          await refreshAll();
          window.setTimeout(() => setDeviceLogin(null), 1200);
          return;
        }

        if (polled.error && polled.error !== "authorization_pending" && polled.error !== "slow_down") {
          throw new Error(polled.error_description || polled.error);
        }
      } catch (error) {
        setDeviceLogin((prev) =>
          prev
            ? {
                ...prev,
                error: summarizeError(error),
                status: locale === "zh-CN" ? "登录失败，请重试" : "Login failed. Please retry.",
              }
            : prev,
        );
        return;
      }
    }

    setDeviceLogin((prev) =>
      prev
        ? {
            ...prev,
            status: locale === "zh-CN" ? "设备码已过期，请重新发起登录" : "Device code expired. Start again.",
          }
        : prev,
    );
  }

  async function loginWithGithub() {
    if (!authConfig?.enabled || authConfig.mode !== "github-device") {
      setTransientNotice(locale === "zh-CN" ? "当前为本地免登录模式" : "Authentication is disabled in local-only mode");
      return;
    }

    try {
      const device = await api<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
      }>("/api/auth/device/start", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const session: DeviceLoginSession = {
        deviceCode: device.device_code,
        userCode: device.user_code,
        verificationUri: device.verification_uri,
        expiresAt: Date.now() + device.expires_in * 1000,
        intervalSec: device.interval || 5,
        status: locale === "zh-CN" ? "等待你在 GitHub 输入验证码..." : "Waiting for authorization on GitHub...",
        error: "",
      };
      setDeviceLogin(session);
      const myPollToken = ++pollTokenRef.current;
      void pollDeviceLogin(session, myPollToken);
    } catch (error) {
      setTransientNotice(summarizeError(error), "error");
    }
  }

  async function copyDeviceCode() {
    if (!deviceLogin) return;
    try {
      await navigator.clipboard.writeText(deviceLogin.userCode);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setTransientNotice(locale === "zh-CN" ? "复制失败，请手动复制" : "Clipboard copy failed. Copy manually.", "error");
    }
  }

  function cancelDeviceLogin() {
    pollTokenRef.current += 1;
    setDeviceLogin(null);
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // Ignore server-side logout failure, local token is still cleared.
    } finally {
      pollTokenRef.current += 1;
      localStorage.removeItem("codex.sessionToken");
      setSessionToken("");
      setPendingTaskMutations({});
      setDeviceLogin(null);
      await refreshAll();
    }
  }

  return {
    loginWithGithub,
    copyDeviceCode,
    cancelDeviceLogin,
    logout,
  };
}
