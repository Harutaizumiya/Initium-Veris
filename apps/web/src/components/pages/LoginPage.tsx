import React, { useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, LoaderCircle, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatErrorMessage } from "../../api";
import { OperationAlert } from "../common/OperationAlert";
import { useAuth } from "../../providers/AuthProvider";

const LOGIN_ERROR_MESSAGE_OPTIONS = {
  fallback: "登录失败，请稍后重试。",
  apiClientMessage: (error: { status: number; message: string }) => {
    if (error.status === 400 && error.message === "validation_error") {
      return "请输入正确的账号和密码。";
    }
    if (error.status === 401 || error.message === "unauthenticated") {
      return "账号或密码错误。";
    }

    return null;
  },
  apiClientFallback: () => "登录失败，请稍后重试。",
  includeNativeErrorMessage: false,
};

function getRedirectTarget(state: unknown) {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from;
  return `${from?.pathname || "/"}${from?.search || ""}`;
}

export const LoginPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTarget = useMemo(() => getRedirectTarget(location.state), [location.state]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordHintVisible, setForgotPasswordHintVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("请输入正确的账号和密码。");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await auth.login({ username, password, remember: rememberMe });
      navigate(redirectTarget, { replace: true });
    } catch (loginError) {
      setError(formatErrorMessage(loginError, LOGIN_ERROR_MESSAGE_OPTIONS));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface bg-cover bg-center bg-no-repeat px-6 py-10 lg:justify-end lg:px-[10vw]"
      style={{ backgroundImage: 'url("/background.png")' }}
    >
      <div className="absolute inset-0 bg-white/10" aria-hidden="true" />

      <section className="relative w-full max-w-md rounded-[2rem] border border-white/70 bg-white/90 px-8 py-10 shadow-[0_32px_80px_rgba(15,47,112,0.18)] backdrop-blur-xl sm:px-12">
          <div>
            
            <h2 className="mt-6 font-headline text-3xl font-extrabold tracking-tight text-on-surface">欢迎回来</h2>
            <p className="mt-2 text-sm text-on-surface-variant">登录账号继续访问 Veris 库存管理平台</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">账号</span>
              <div className="relative">
                <UserRound size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="text"
                  lang="en"
                  spellCheck={false}
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-surface-container-low py-3 pl-11 pr-4 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="输入账号"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-on-surface">密码</span>
              <div className="relative">
                <LockKeyhole size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="text"
                  lang="en"
                  spellCheck={false}
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-surface-container-low py-3 pl-11 pr-12 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="输入密码"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((current) => !current)}
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                  aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                  title={passwordVisible ? "隐藏密码" : "显示密码"}
                >
                  {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between gap-4">
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border border-surface-container text-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="font-medium text-on-surface">记住我</span>
              </label>

              <button
                type="button"
                onClick={() => setForgotPasswordHintVisible((current) => !current)}
                className="text-sm font-semibold text-primary transition-colors hover:text-primary-container"
              >
                忘记密码？
              </button>
            </div>

            {forgotPasswordHintVisible ? (
              <OperationAlert
                type="info"
                title="忘记密码"
                description="请联系系统管理员或后端管理员重置账号密码。"
                showIcon
                closable
              />
            ) : null}

            {error ? <OperationAlert type="error" title="登录失败" description={error} showIcon /> : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <LoaderCircle size={16} className="animate-spin" /> : null}
              登录
            </button>
          </form>
      </section>
    </main>
  );
};
