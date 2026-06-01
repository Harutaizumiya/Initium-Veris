import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  ApiClientError,
  createRole,
  createUser,
  deleteRole,
  listPermissions,
  listRoles,
  listUsers,
  queryKeys,
  resetUserPassword,
  updateRole,
  updateUser,
  type AuthAdminUser,
  type AuthRole,
  type PermissionGroup,
} from "../../api";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { useNotification } from "../../providers/NotificationProvider";
import { getErrorDebugDetail } from "../common/OperationFeedbackToast";

interface RoleFormState {
  id: number | null;
  name: string;
  permissionCodes: string[];
}

interface UserFormState {
  id: number | null;
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isStaff: boolean;
  groupIds: number[];
  permissionCodes: string[];
}

const EMPTY_ROLE_FORM: RoleFormState = {
  id: null,
  name: "",
  permissionCodes: [],
};

const EMPTY_USER_FORM: UserFormState = {
  id: null,
  username: "",
  password: "",
  email: "",
  firstName: "",
  lastName: "",
  isActive: true,
  isStaff: false,
  groupIds: [],
  permissionCodes: [],
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return "当前账号没有管理用户权限。";
    }
    if (error.status === 409) {
      return "数据冲突，请检查名称或关联关系。";
    }
    if (error.status === 400) {
      return "提交内容不完整或格式不正确。";
    }
  }

  return "操作失败，请稍后重试。";
}

function getAdminUserName(user: AuthAdminUser) {
  const fullName = [user.last_name, user.first_name].filter(Boolean).join("");
  return fullName || user.username;
}

function toggleNumber(list: number[], value: number) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function toggleString(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">{title}</h2>
      <p className="mt-1 text-on-surface-variant">{description}</p>
    </div>
  );
}

function PageTitleWithAction({
  action,
  description,
  title,
}: {
  action: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">{title}</h2>
        <p className="mt-1 text-on-surface-variant">{description}</p>
      </div>
      {action}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-3xl border border-surface-container/10 bg-surface-container-lowest px-6 py-12 text-sm font-semibold text-on-surface-variant ambient-shadow">
      <LoaderCircle size={18} className="animate-spin text-primary" />
      {label}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">{message}</div>;
}

function PermissionChecklist({
  groups,
  selected,
  onToggle,
  disabled = false,
}: {
  groups: PermissionGroup[];
  selected: string[];
  onToggle: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="max-h-[360px] space-y-4 overflow-y-auto rounded-2xl border border-surface-container bg-surface-container-low p-4">
      {groups.map((group) => (
        <section key={group.component}>
          <h4 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">{group.component}</h4>
          <div className="grid gap-2">
            {group.permissions.map((permission) => (
              <label
                key={permission.code}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border border-surface-container bg-surface-container-lowest px-4 py-3 transition-colors hover:border-primary/20",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(permission.code)}
                  disabled={disabled}
                  onChange={() => onToggle(permission.code)}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-on-surface">{permission.name || permission.code}</span>
                  <span className="mt-1 block break-all text-xs leading-5 text-on-surface-variant">
                    {permission.code} · {permission.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export const SettingsProfilePage: React.FC = () => {
  const { hasPermission, user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="账号信息" description="查看当前登录用户、角色状态和后端返回的有效业务权限。" />
      <section className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-8 ambient-shadow">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-black text-primary">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-headline text-2xl font-extrabold text-on-surface">{user.displayName}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                {user.username} · {user.roleLabel}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">
            有效权限 <span className="font-headline text-2xl font-black text-on-surface">{user.permissions.length}</span> 项
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoTile label="邮箱" value={user.email || "-"} />
          <InfoTile label="Staff" value={user.isStaff ? "是" : "否"} />
          <InfoTile label="超级管理员" value={user.isSuperuser ? "是" : "否"} />
        </div>
        <div className="mt-8 rounded-2xl border border-surface-container bg-surface-container-low p-5">
          <h4 className="text-sm font-bold text-on-surface">权限摘要</h4>
          <div className="mt-4 flex flex-wrap gap-2">
            {user.isSuperuser ? (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">超级管理员拥有全部权限</span>
            ) : user.permissions.length > 0 ? (
              user.permissions.map((permission) => (
                <span key={permission} className="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-on-surface-variant">
                  {permission}
                </span>
              ))
            ) : (
              <span className="text-sm text-on-surface-variant">当前账号没有业务权限。</span>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {["products_read", "batches_read", "dashboard_read", "analytics_read"].map((permission) => (
            <InfoTile key={permission} label={permission} value={hasPermission(permission) ? "可访问" : "不可访问"} />
          ))}
        </div>
      </section>
    </div>
  );
};

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low px-5 py-4">
      <div className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</div>
      <div className="mt-2 break-all text-sm font-bold text-on-surface">{value}</div>
    </div>
  );
}

function useAdminReferenceData() {
  const permissionsQuery = useQuery({
    queryKey: queryKeys.authManagement.permissions(),
    queryFn: listPermissions,
  });
  const rolesQuery = useQuery({
    queryKey: queryKeys.authManagement.roles(),
    queryFn: listRoles,
  });

  return { permissionsQuery, rolesQuery };
}

export const PermissionDirectoryPage: React.FC = () => {
  const permissionsQuery = useQuery({
    queryKey: queryKeys.authManagement.permissions(),
    queryFn: listPermissions,
  });
  const groups = permissionsQuery.data ?? [];

  return (
    <div>
      <PageTitle title="权限目录" description="后端业务权限按 component 分组返回，前端只读展示并用于角色与用户授权。" />
      {permissionsQuery.isLoading ? <LoadingBlock label="正在加载权限目录" /> : null}
      {permissionsQuery.error ? <ErrorBlock message={getErrorMessage(permissionsQuery.error)} /> : null}
      {!permissionsQuery.isLoading && !permissionsQuery.error ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.map((group) => (
            <section key={group.component} className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6 ambient-shadow">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-headline text-xl font-bold text-on-surface">{group.component}</h3>
                <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface-variant">
                  {group.permissions.length} 项
                </span>
              </div>
              <div className="space-y-3">
                {group.permissions.map((permission) => (
                  <div key={permission.code} className="rounded-2xl border border-surface-container bg-surface-container-low p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-primary">{permission.code}</span>
                      <span className="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-bold text-on-surface-variant">
                        {permission.action}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-bold text-on-surface">{permission.name}</div>
                    <p className="mt-1 text-sm leading-6 text-on-surface-variant">{permission.description}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const RoleManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { permissionsQuery, rolesQuery } = useAdminReferenceData();
  const [form, setForm] = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const notify = useNotification();
  const groups = permissionsQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const loading = permissionsQuery.isLoading || rolesQuery.isLoading;
  const error = permissionsQuery.error || rolesQuery.error;

  const resetForm = () => {
    setForm(EMPTY_ROLE_FORM);
    setFeedback(null);
  };

  const openCreateRole = () => {
    resetForm();
    setIsRoleModalOpen(true);
  };

  const editRole = (role: AuthRole) => {
    setForm({ id: role.id, name: role.name, permissionCodes: role.permissions });
    setFeedback(null);
    setIsRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    if (submitting) {
      return;
    }
    setIsRoleModalOpen(false);
    resetForm();
  };

  const submitRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFeedback("请输入角色名称。");
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      if (form.id) {
        await updateRole(form.id, { name: form.name, permission_codes: form.permissionCodes });
      } else {
        await createRole({ name: form.name, permission_codes: form.permissionCodes });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.authManagement.roles() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.authManagement.users() });
      setIsRoleModalOpen(false);
      setForm(EMPTY_ROLE_FORM);
      notify.success({
        title: "角色已保存",
        description: form.id ? "角色更新已同步到权限配置。" : "新角色已创建并写入权限配置。",
      });
    } catch (error) {
      notify.error({
        title: "保存角色失败",
        description: getErrorMessage(error),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const removeRole = async (role: AuthRole) => {
    setDeletingId(role.id);
    setFeedback(null);
    try {
      await deleteRole(role.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.authManagement.roles() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.authManagement.users() });
      if (form.id === role.id) {
        resetForm();
      }
      notify.success({
        title: "角色已删除",
        description: `${role.name} 已从角色目录移除。`,
      });
    } catch (error) {
      const description = error instanceof ApiClientError && error.status === 409 ? "该角色已分配给用户，无法删除。" : getErrorMessage(error);
      notify.error({
        title: "删除角色失败",
        description,
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
      <div>
      <PageTitleWithAction
        title="角色管理"
        description="创建 Django Group 角色，并为角色整体配置业务权限。"
        action={
          <button
            type="button"
            onClick={openCreateRole}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
          >
            <Plus size={18} />
            新增角色
          </button>
        }
      />
      {loading ? <LoadingBlock label="正在加载角色与权限" /> : null}
      {error ? <ErrorBlock message={getErrorMessage(error)} /> : null}
      {!loading && !error ? (
        <>
          <section className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6 ambient-shadow">
            <div className="mb-5">
              <h3 className="font-headline text-xl font-bold text-on-surface">角色列表</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{roles.length} 个角色</p>
            </div>
            {!isRoleModalOpen && feedback ? (
              <div className="mb-5 rounded-2xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">{feedback}</div>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-surface-container">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  <tr>
                    <th className="px-5 py-4">角色</th>
                    <th className="px-5 py-4">权限数量</th>
                    <th className="px-5 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-surface-container-low/40">
                      <td className="px-5 py-4">
                        <div className="font-bold text-on-surface">{role.name}</div>
                        <div className="mt-1 max-w-2xl truncate text-sm text-on-surface-variant">
                          {role.permissions.length > 0 ? role.permissions.join("、") : "未配置权限"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">{role.permissions.length} 项</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editRole(role)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-surface-container bg-white text-on-surface-variant hover:text-primary"
                            aria-label={`编辑 ${role.name}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeRole(role)}
                            disabled={deletingId === role.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-50"
                            aria-label={`删除 ${role.name}`}
                          >
                            {deletingId === role.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <RoleFormModal
            feedback={feedback}
            form={form}
            groups={groups}
            open={isRoleModalOpen}
            submitting={submitting}
            onChange={(updater) => {
              setForm(updater);
              setFeedback(null);
            }}
            onClose={closeRoleModal}
            onSubmit={submitRole}
          />
        </>
      ) : null}
    </div>
  );
};

function RoleFormModal({
  feedback,
  form,
  groups,
  open,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: {
  feedback: string | null;
  form: RoleFormState;
  groups: PermissionGroup[];
  open: boolean;
  submitting: boolean;
  onChange: (updater: (current: RoleFormState) => RoleFormState) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[3px]"
            onClick={submitting ? undefined : onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.form
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onSubmit={onSubmit}
              className="ambient-shadow pointer-events-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest"
            >
              <div className="flex items-start justify-between gap-4 border-b border-surface-container-high px-8 py-6">
                <div className="min-w-0">
                  <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">{form.id ? "编辑角色" : "新增角色"}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">设置角色名称，并整体配置该角色拥有的业务权限。</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-surface-container bg-white text-on-surface-variant transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="关闭角色表单"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-8 py-7">
                <TextInput label="角色名称" value={form.name} onChange={(value) => onChange((current) => ({ ...current, name: value }))} />
                <div className="mt-6">
                  <div className="mb-2 text-sm font-semibold text-on-surface">角色权限</div>
                  <PermissionChecklist
                    groups={groups}
                    selected={form.permissionCodes}
                    onToggle={(code) => onChange((current) => ({ ...current, permissionCodes: toggleString(current.permissionCodes, code) }))}
                  />
                </div>
                {feedback ? <div className="mt-5 rounded-2xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">{feedback}</div> : null}
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-surface-container-high bg-white/80 px-8 py-6 backdrop-blur-sm sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-2xl border border-surface-container px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                  保存角色
                </button>
              </div>
            </motion.form>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function UserFormModal({
  feedback,
  form,
  groups,
  open,
  passwordResetValue,
  resettingPassword,
  roles,
  selectedUser,
  submitting,
  onChange,
  onClose,
  onPasswordReset,
  onPasswordResetValueChange,
  onSubmit,
}: {
  feedback: string | null;
  form: UserFormState;
  groups: PermissionGroup[];
  open: boolean;
  passwordResetValue: string;
  resettingPassword: boolean;
  roles: AuthRole[];
  selectedUser: AuthAdminUser | null;
  submitting: boolean;
  onChange: (updater: (current: UserFormState) => UserFormState) => void;
  onClose: () => void;
  onPasswordReset: () => void;
  onPasswordResetValueChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[3px]"
            onClick={submitting || resettingPassword ? undefined : onClose}
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.form
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onSubmit={onSubmit}
              className="ambient-shadow pointer-events-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest"
            >
              <div className="flex items-start justify-between gap-4 border-b border-surface-container-high px-8 py-6">
                <div className="min-w-0">
                  <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">{form.id ? "编辑用户" : "新增用户"}</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">配置用户资料、启用状态、角色和直接权限。</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting || resettingPassword}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-surface-container bg-white text-on-surface-variant transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="关闭用户表单"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-7">
                <div className="grid gap-5 md:grid-cols-2">
                  <TextInput label="用户名" value={form.username} disabled={Boolean(form.id)} onChange={(value) => onChange((current) => ({ ...current, username: value }))} />
                  {!form.id ? (
                    <TextInput label="初始密码" type="password" value={form.password} onChange={(value) => onChange((current) => ({ ...current, password: value }))} />
                  ) : null}
                  <TextInput label="邮箱" value={form.email} onChange={(value) => onChange((current) => ({ ...current, email: value }))} />
                  <TextInput label="姓" value={form.lastName} onChange={(value) => onChange((current) => ({ ...current, lastName: value }))} />
                  <TextInput label="名" value={form.firstName} onChange={(value) => onChange((current) => ({ ...current, firstName: value }))} />
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <ToggleLabel label="启用账号" checked={form.isActive} onChange={(checked) => onChange((current) => ({ ...current, isActive: checked }))} />
                  <ToggleLabel label="Staff 用户" checked={form.isStaff} onChange={(checked) => onChange((current) => ({ ...current, isStaff: checked }))} />
                </div>
                <div className="mt-6">
                  <div className="mb-2 text-sm font-semibold text-on-surface">角色</div>
                  <div className="grid gap-2 rounded-2xl border border-surface-container bg-surface-container-low p-4 md:grid-cols-2">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-lowest">
                        <input
                          type="checkbox"
                          checked={form.groupIds.includes(role.id)}
                          onChange={() => onChange((current) => ({ ...current, groupIds: toggleNumber(current.groupIds, role.id) }))}
                          className="h-4 w-4 accent-primary"
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-6">
                  <div className="mb-2 text-sm font-semibold text-on-surface">直接权限</div>
                  <PermissionChecklist
                    groups={groups}
                    selected={form.permissionCodes}
                    onToggle={(code) => onChange((current) => ({ ...current, permissionCodes: toggleString(current.permissionCodes, code) }))}
                  />
                </div>
                {selectedUser ? (
                  <div className="mt-6 rounded-2xl border border-surface-container bg-surface-container-low p-5">
                    <div className="mb-3 text-sm font-bold text-on-surface">重置密码</div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="password"
                        value={passwordResetValue}
                        onChange={(event) => onPasswordResetValueChange(event.target.value)}
                        className="min-w-0 flex-1 rounded-2xl border border-surface-container bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                        placeholder="输入新密码"
                      />
                      <button
                        type="button"
                        onClick={onPasswordReset}
                        disabled={resettingPassword}
                        className="inline-flex items-center justify-center rounded-2xl bg-surface-container-high px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
                      >
                        {resettingPassword ? "处理中" : "重置"}
                      </button>
                    </div>
                  </div>
                ) : null}
                {feedback ? <div className="mt-5 rounded-2xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">{feedback}</div> : null}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-surface-container-high bg-white/80 px-8 py-6 backdrop-blur-sm sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting || resettingPassword}
                  className="rounded-2xl border border-surface-container px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                  保存用户
                </button>
              </div>
            </motion.form>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export const UserManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { permissionsQuery, rolesQuery } = useAdminReferenceData();
  const usersQuery = useQuery({
    queryKey: queryKeys.authManagement.users(),
    queryFn: listUsers,
  });
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [passwordResetValue, setPasswordResetValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const notify = useNotification();
  const groups = permissionsQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const loading = permissionsQuery.isLoading || rolesQuery.isLoading || usersQuery.isLoading;
  const error = permissionsQuery.error || rolesQuery.error || usersQuery.error;

  const selectedUser = useMemo(() => users.find((user) => user.id === form.id) ?? null, [form.id, users]);

  const resetForm = () => {
    setForm(EMPTY_USER_FORM);
    setPasswordResetValue("");
    setFeedback(null);
  };

  const closeUserModal = () => {
    if (submitting || resettingPassword) {
      return;
    }
    setIsUserModalOpen(false);
    resetForm();
  };

  const openCreateUser = () => {
    resetForm();
    setIsUserModalOpen(true);
  };

  const editUser = (user: AuthAdminUser) => {
    setForm({
      id: user.id,
      username: user.username,
      password: "",
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      isActive: user.is_active,
      isStaff: user.is_staff,
      groupIds: user.groups.map((group) => group.id),
      permissionCodes: user.direct_permissions,
    });
    setPasswordResetValue("");
    setFeedback(null);
    setIsUserModalOpen(true);
  };

  const submitUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.username.trim()) {
      setFeedback("请输入用户名。");
      return;
    }
    if (!form.id && !form.password) {
      setFeedback("创建用户时必须设置初始密码。");
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      if (form.id) {
        await updateUser(form.id, {
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          is_active: form.isActive,
          is_staff: form.isStaff,
          group_ids: form.groupIds,
          permission_codes: form.permissionCodes,
        });
      } else {
        await createUser({
          username: form.username,
          password: form.password,
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          is_active: form.isActive,
          is_staff: form.isStaff,
          group_ids: form.groupIds,
          permission_codes: form.permissionCodes,
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.authManagement.users() });
      setIsUserModalOpen(false);
      setForm(EMPTY_USER_FORM);
      setPasswordResetValue("");
      notify.success({
        title: "用户已保存",
        description: form.id ? "用户资料与权限已更新。" : "新用户已创建。",
      });
    } catch (error) {
      notify.error({
        title: "保存用户失败",
        description: getErrorMessage(error),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!form.id || !passwordResetValue) {
      setFeedback("请输入新密码。");
      return;
    }

    setResettingPassword(true);
    setFeedback(null);
    try {
      await resetUserPassword(form.id, passwordResetValue);
      setPasswordResetValue("");
      notify.success({
        title: "密码已重置",
        description: "用户密码已更新，请通知对方使用新密码登录。",
      });
    } catch (error) {
      notify.error({
        title: "重置密码失败",
        description: getErrorMessage(error),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
      <div>
      <PageTitleWithAction
        title="用户管理"
        description="创建用户、分配角色和直接权限；超级管理员身份不能通过该接口授予。"
        action={
          <button
            type="button"
            onClick={openCreateUser}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
          >
            <Plus size={18} />
            新增用户
          </button>
        }
      />
      {loading ? <LoadingBlock label="正在加载用户、角色与权限" /> : null}
      {error ? <ErrorBlock message={getErrorMessage(error)} /> : null}
      {!loading && !error ? (
        <>
          <section className="rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6 ambient-shadow">
            <div className="mb-5">
              <h3 className="font-headline text-xl font-bold text-on-surface">用户列表</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{users.length} 个用户</p>
            </div>
            {!isUserModalOpen && feedback ? (
              <div className="mb-5 rounded-2xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface-variant">{feedback}</div>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-surface-container">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  <tr>
                    <th className="px-5 py-4">用户</th>
                    <th className="px-5 py-4">状态</th>
                    <th className="px-5 py-4">角色</th>
                    <th className="px-5 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-container-low/40">
                      <td className="px-5 py-4">
                        <div className="font-bold text-on-surface">{getAdminUserName(user)}</div>
                        <div className="mt-1 text-sm text-on-surface-variant">{user.username} · {user.email || "-"}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">
                        {user.is_active ? "启用" : "停用"} · {user.is_superuser ? "超级管理员" : user.is_staff ? "Staff" : "普通"}
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface-variant">
                        {user.groups.map((group) => group.name).join("、") || "-"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => editUser(user)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-surface-container bg-white text-on-surface-variant hover:text-primary"
                          aria-label={`编辑 ${user.username}`}
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <UserFormModal
            feedback={feedback}
            form={form}
            groups={groups}
            open={isUserModalOpen}
            passwordResetValue={passwordResetValue}
            resettingPassword={resettingPassword}
            roles={roles}
            selectedUser={selectedUser}
            submitting={submitting}
            onChange={(updater) => {
              setForm(updater);
              setFeedback(null);
            }}
            onClose={closeUserModal}
            onPasswordReset={() => void resetPassword()}
            onPasswordResetValueChange={setPasswordResetValue}
            onSubmit={submitUser}
          />
        </>
      ) : null}
    </div>
  );
};

function TextInput({
  disabled = false,
  label,
  onChange,
  type = "text",
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-on-surface">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function ToggleLabel({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-surface-container bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-primary" />
    </label>
  );
}
