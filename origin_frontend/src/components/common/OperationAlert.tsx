import React, { useState } from "react";
import { CircleAlert, CircleCheckBig, Info, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type OperationAlertType = "success" | "info" | "warning" | "error";

interface OperationAlertProps {
  title: string;
  description?: string;
  type?: OperationAlertType;
  showIcon?: boolean;
  closable?: boolean;
  className?: string;
}

const alertStyles: Record<
  OperationAlertType,
  {
    container: string;
    iconContainer: string;
    iconClassName: string;
    titleClassName: string;
    descriptionClassName: string;
  }
> = {
  success: {
    container: "border-emerald-200/80 bg-emerald-50/80",
    iconContainer: "bg-emerald-500/12",
    iconClassName: "text-emerald-600",
    titleClassName: "text-emerald-900",
    descriptionClassName: "text-emerald-800/85",
  },
  info: {
    container: "border-primary/15 bg-primary/5",
    iconContainer: "bg-primary/10",
    iconClassName: "text-primary",
    titleClassName: "text-on-surface",
    descriptionClassName: "text-on-surface-variant",
  },
  warning: {
    container: "border-amber-200/90 bg-amber-50/90",
    iconContainer: "bg-amber-500/12",
    iconClassName: "text-amber-600",
    titleClassName: "text-amber-950",
    descriptionClassName: "text-amber-900/85",
  },
  error: {
    container: "border-error/20 bg-error/10",
    iconContainer: "bg-error/12",
    iconClassName: "text-error",
    titleClassName: "text-on-surface",
    descriptionClassName: "text-on-surface-variant",
  },
};

function getAlertIcon(type: OperationAlertType) {
  switch (type) {
    case "success":
      return CircleCheckBig;
    case "warning":
      return CircleAlert;
    case "error":
      return CircleAlert;
    case "info":
    default:
      return Info;
  }
}

export const OperationAlert: React.FC<OperationAlertProps> = ({
  title,
  description,
  type = "info",
  showIcon = true,
  closable = false,
  className,
}) => {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  const styles = alertStyles[type];
  const Icon = getAlertIcon(type);

  return (
    <div
      className={cn(
        "relative flex gap-4 rounded-3xl border p-5 shadow-sm transition-all",
        styles.container,
        className,
      )}
      role="alert"
    >
      {showIcon ? (
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", styles.iconContainer)}>
          <Icon size={20} className={styles.iconClassName} />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className={cn("font-headline text-base font-bold tracking-tight", styles.titleClassName)}>{title}</div>
        {description ? <p className={cn("mt-1 text-sm leading-6", styles.descriptionClassName)}>{description}</p> : null}
      </div>

      {closable ? (
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          aria-label="关闭提示"
          title="关闭提示"
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
};

export const OperationAlertGallery: React.FC = () => (
  <div className="grid gap-4">
    <OperationAlert title="成功提示" type="success" showIcon />
    <OperationAlert title="信息说明" type="info" showIcon />
    <OperationAlert title="操作警告" type="warning" showIcon closable />
    <OperationAlert title="错误提示" type="error" showIcon />
    <OperationAlert
      title="成功提示"
      description="当前批次已成功完成创建，建议继续核对数量、生产日期和到期日期。"
      type="success"
      showIcon
    />
    <OperationAlert
      title="信息说明"
      description="该模块适合承接流程提示、接口反馈、数据同步说明等中等优先级通知。"
      type="info"
      showIcon
    />
    <OperationAlert
      title="操作警告"
      description="当前操作会影响库存数据，请在提交前再次确认批次、数量和备注内容。"
      type="warning"
      showIcon
      closable
    />
    <OperationAlert
      title="错误提示"
      description="请求执行失败，请检查网络连接、接口状态或表单参数后再重试。"
      type="error"
      showIcon
    />
  </div>
);
