import {
  ApiClientError,
  type AnalyticsRange,
  type AnalyticsSummaryDto,
  type AuthAdminUser,
  type AuthenticatedUserDto,
  type AuthRole,
  type BatchDto,
  type BatchLabelPayloadDto,
  type BatchOperationDto,
  type BatchOperationMutationInput,
  type DashboardOverviewDto,
  type PermissionGroup,
  type Product,
  type ProductMutationInput,
  type QrScanAuditItemDto,
  type QrScanInput,
  type QrScanResultDto,
  type QrScanStatus,
  type StocktakeAuditLogDto,
  type StocktakeCreateInput,
  type StocktakeItemDto,
  type StocktakeTaskDto,
  type StocktakeTaskStatus,
  type StocktakeTaskType,
} from "@initium-veris/api-client";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_USER_DTO: AuthenticatedUserDto = {
  id: 1,
  username: "demo.admin",
  email: "demo.admin@initium-veris.local",
  first_name: "Veris",
  last_name: "Demo",
  is_staff: true,
  is_superuser: true,
  permissions: [],
};

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    component: "dashboard",
    permissions: [{ code: "dashboard_read", name: "查看总览", component: "dashboard", action: "read", description: "查看库存总览与效期预警。" }],
  },
  {
    component: "products",
    permissions: [
      { code: "products_read", name: "查看商品", component: "products", action: "read", description: "查看商品目录。" },
      { code: "products_create", name: "创建商品", component: "products", action: "create", description: "新增商品主数据。" },
      { code: "products_update", name: "更新商品", component: "products", action: "update", description: "编辑商品主数据。" },
      { code: "products_delete", name: "删除商品", component: "products", action: "delete", description: "删除演示商品。" },
    ],
  },
  {
    component: "batches",
    permissions: [
      { code: "batches_read", name: "查看批次", component: "batches", action: "read", description: "查看批次库存。" },
      { code: "batches_create", name: "创建批次", component: "batches", action: "create", description: "创建入库批次。" },
      { code: "batches_operate", name: "库存操作", component: "batches", action: "operate", description: "执行入库、出库、报损等批次操作。" },
      { code: "batches_print_label", name: "打印标签", component: "batches", action: "print_label", description: "签发并打印批次二维码标签。" },
      { code: "batch_operations_read", name: "查看流水", component: "batches", action: "read_operations", description: "查看批次操作流水。" },
      { code: "batch_operations_revert", name: "撤销流水", component: "batches", action: "revert_operation", description: "撤销可回滚的批次操作。" },
    ],
  },
  {
    component: "qr_scans",
    permissions: [
      { code: "qr_scans_create", name: "扫码审计", component: "qr_scans", action: "create", description: "提交二维码扫码审计。" },
      { code: "qr_scans_read", name: "查看扫码", component: "qr_scans", action: "read", description: "查看扫码审计历史。" },
    ],
  },
  {
    component: "stocktakes",
    permissions: [
      { code: "stocktakes_read", name: "查看盘点", component: "stocktakes", action: "read", description: "查看盘点任务。" },
      { code: "stocktakes_create", name: "创建盘点", component: "stocktakes", action: "create", description: "创建盘点任务。" },
      { code: "stocktakes_update_scope", name: "维护范围", component: "stocktakes", action: "update_scope", description: "维护盘点范围。" },
      { code: "stocktakes_count", name: "录入实盘", component: "stocktakes", action: "count", description: "录入盘点实盘数量。" },
      { code: "stocktakes_submit", name: "提交复核", component: "stocktakes", action: "submit", description: "提交盘点复核。" },
      { code: "stocktakes_approve", name: "审批盘点", component: "stocktakes", action: "approve", description: "审批盘点并生成调整。" },
      { code: "stocktakes_cancel", name: "取消盘点", component: "stocktakes", action: "cancel", description: "取消未完成盘点。" },
    ],
  },
  {
    component: "analytics",
    permissions: [{ code: "analytics_read", name: "查看分析", component: "analytics", action: "read", description: "查看库存分析报表。" }],
  },
];

function today() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function dateOffset(days: number) {
  return new Date(today().getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function isoOffset(days: number, hours = 9) {
  const date = new Date(today().getTime() + days * DAY_MS);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

function addDays(date: string, days: number) {
  return new Date(new Date(`${date}T00:00:00`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function parseQuantity(value: string | number | null | undefined) {
  return Number.parseFloat(String(value ?? "0")) || 0;
}

function formatQuantity(value: number) {
  return value.toFixed(Number.isInteger(value) ? 0 : 2);
}

function paginate<T>(items: T[], page = 1, size = 20) {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, size);
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    pagination: {
      page: safePage,
      size: safeSize,
      total: items.length,
    },
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function allPermissionCodes() {
  return PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.code));
}

function expiryMeta(manufactureDate: string | null, expireDate: string | null) {
  if (!expireDate) {
    return { daysUntilExpiry: null, progress: null, status: "normal" as const };
  }
  const now = today().getTime();
  const expire = new Date(`${expireDate}T23:59:00`).getTime();
  const manufacture = manufactureDate ? new Date(`${manufactureDate}T00:00:00`).getTime() : now;
  const remainingMs = expire - now;
  const remainingDays = remainingMs < 0 ? -Math.max(1, Math.ceil(Math.abs(remainingMs) / DAY_MS)) : Math.ceil(remainingMs / DAY_MS);
  const totalMs = Math.max(DAY_MS, expire - manufacture);
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs));

  if (remainingDays < 0) {
    return { daysUntilExpiry: remainingDays, progress, status: "expired" as const };
  }
  if (remainingDays <= 3 || progress < 0.2) {
    return { daysUntilExpiry: remainingDays, progress, status: "critical" as const };
  }
  if (remainingDays <= 15 || progress <= 0.5) {
    return { daysUntilExpiry: remainingDays, progress, status: "warning" as const };
  }
  return { daysUntilExpiry: remainingDays, progress, status: "normal" as const };
}

const initialProducts: Product[] = [
  ["北海道鲜奶", "IV-P-1001", "乳制品", "冷藏库 A-01", "箱", 14, "北辰牧业"],
  ["原味酸奶", "IV-P-1002", "乳制品", "冷藏库 A-02", "箱", 21, "北辰牧业"],
  ["冷冻牛肉卷", "IV-P-1003", "肉禽水产", "冷冻库 B-03", "箱", 180, "青川食品"],
  ["鸡胸肉", "IV-P-1004", "肉禽水产", "冷冻库 B-01", "箱", 120, "青川食品"],
  ["三文鱼切片", "IV-P-1005", "肉禽水产", "冷冻库 B-05", "盒", 90, "远洋鲜食"],
  ["有机生菜", "IV-P-1006", "蔬果", "冷藏库 C-02", "筐", 7, "春田农场"],
  ["番茄", "IV-P-1007", "蔬果", "常温区 D-01", "筐", 10, "春田农场"],
  ["吐司面包", "IV-P-1008", "烘焙", "常温区 D-03", "袋", 5, "麦田工坊"],
  ["冷萃咖啡液", "IV-P-1009", "饮品", "冷藏库 A-05", "瓶", 30, "晨光饮品"],
  ["橙汁", "IV-P-1010", "饮品", "冷藏库 A-06", "瓶", 18, "晨光饮品"],
  ["黑胡椒酱", "IV-P-1011", "调味品", "常温区 E-02", "瓶", 360, "和味食品"],
  ["沙拉酱", "IV-P-1012", "调味品", "冷藏库 A-07", "瓶", 120, "和味食品"],
  ["速冻薯条", "IV-P-1013", "冷冻半成品", "冷冻库 B-02", "袋", 240, "金穗食品"],
  ["披萨饼底", "IV-P-1014", "冷冻半成品", "冷冻库 B-04", "袋", 180, "麦田工坊"],
  ["餐盒", "IV-P-1015", "耗材", "常温区 F-01", "箱", 720, "恒洁包装"],
  ["一次性手套", "IV-P-1016", "耗材", "常温区 F-02", "箱", 720, "恒洁包装"],
  ["抹茶粉", "IV-P-1017", "干货", "常温区 E-05", "袋", 300, "山野制茶"],
  ["燕麦片", "IV-P-1018", "干货", "常温区 E-06", "袋", 240, "谷粒工坊"],
].map(([productName, barcode, category, location, unit, shelfLifeDays, manufacturer], index) => ({
  id: index + 1,
  barcode: String(barcode),
  product_name: String(productName),
  shelf_life_days: Number(shelfLifeDays),
  location: String(location),
  category: String(category),
  unit: String(unit),
  manufacturer: String(manufacturer),
  created_at: isoOffset(-18 - index),
  updated_at: isoOffset(-2),
}));

function createInitialBatches(products: Product[]) {
  const specs = [
    [1, -11, 24, "到货质检合格"],
    [1, -4, 12, "补货批次"],
    [2, -20, 16, "门店促销库存"],
    [3, -80, 36, "冷冻整箱"],
    [4, -118, 20, "即将清库"],
    [5, -96, 12, "临期关注"],
    [6, -5, 8, "高周转"],
    [7, -12, 14, "已过期待处置"],
    [8, -3, 18, "早餐档库存"],
    [9, -20, 24, "饮品线"],
    [10, -17, 12, "鲜榨线"],
    [11, -80, 30, "常温安全库存"],
    [12, -105, 10, "临期调味品"],
    [13, -35, 40, "冷冻半成品"],
    [14, -150, 22, "披萨线"],
    [15, -90, 80, "耗材安全库存"],
    [17, -260, 10, "茶饮线"],
    [18, -30, 18, "早餐线"],
  ] as const;

  return specs.map(([productId, manufactureOffset, quantity, remarks], index) => {
    const product = products.find((item) => item.id === productId)!;
    const manufactureDate = dateOffset(manufactureOffset);
    const expireDate = addDays(manufactureDate, product.shelf_life_days);
    const receivedAt = isoOffset(manufactureOffset + 1, 10);
    return makeBatch({
      id: index + 1,
      product,
      quantity,
      manufactureDate,
      expireDate,
      receivedAt,
      remarks,
      batchCode: `IV${String(productId).padStart(3, "0")}-${dateOffset(manufactureOffset).replaceAll("-", "")}-${String(index + 1).padStart(2, "0")}`,
    });
  });
}

function makeBatch(input: {
  id: number;
  product: Product;
  quantity: number;
  manufactureDate: string;
  expireDate: string;
  receivedAt: string;
  remarks: string | null;
  batchCode: string;
}): BatchDto {
  const meta = expiryMeta(input.manufactureDate, input.expireDate);
  return {
    id: input.id,
    product_id: input.product.id,
    batch_code: input.batchCode,
    quantity: formatQuantity(input.quantity),
    received_at: input.receivedAt,
    manufacture_date: input.manufactureDate,
    expire_date: input.expireDate,
    status: input.quantity > 0 ? "active" : "used_up",
    remarks: input.remarks,
    days_until_expiry: meta.daysUntilExpiry,
    expiry_progress: meta.progress,
    expiry_status: meta.status,
    product: {
      id: input.product.id,
      barcode: input.product.barcode,
      product_name: input.product.product_name,
      unit: input.product.unit,
      manufacturer: input.product.manufacturer,
      shelf_life_days: input.product.shelf_life_days,
    },
  };
}

function refreshBatch(batch: BatchDto, product: Product): BatchDto {
  const meta = expiryMeta(batch.manufacture_date, batch.expire_date);
  const quantity = parseQuantity(batch.quantity);
  return {
    ...batch,
    status: quantity > 0 ? "active" : "used_up",
    days_until_expiry: meta.daysUntilExpiry,
    expiry_progress: meta.progress,
    expiry_status: meta.status,
    product: {
      id: product.id,
      barcode: product.barcode,
      product_name: product.product_name,
      unit: product.unit,
      manufacturer: product.manufacturer,
      shelf_life_days: product.shelf_life_days,
    },
  };
}

let products = clone(initialProducts);
let batches = createInitialBatches(products);
let roles: AuthRole[] = [
  { id: 1, name: "演示管理员", permissions: allPermissionCodes() },
  { id: 2, name: "仓库操作员", permissions: ["products_read", "batches_read", "batches_create", "batches_operate", "batch_operations_read", "qr_scans_create", "stocktakes_read", "stocktakes_count"] },
  { id: 3, name: "运营分析", permissions: ["dashboard_read", "analytics_read", "products_read", "batches_read", "qr_scans_read"] },
];
let users: AuthAdminUser[] = [
  {
    id: 1,
    username: "demo.admin",
    email: "demo.admin@initium-veris.local",
    first_name: "Veris",
    last_name: "Demo",
    is_active: true,
    is_staff: true,
    is_superuser: true,
    groups: [roles[0]],
    direct_permissions: [],
    effective_permissions: allPermissionCodes(),
  },
  {
    id: 2,
    username: "warehouse",
    email: "warehouse@initium-veris.local",
    first_name: "Operator",
    last_name: "Warehouse",
    is_active: true,
    is_staff: true,
    is_superuser: false,
    groups: [roles[1]],
    direct_permissions: [],
    effective_permissions: roles[1].permissions,
  },
];
let operations: BatchOperationDto[] = batches.map((batch, index) => ({
  id: index + 1,
  batch_id: batch.id,
  operation_type: "add",
  quantity: batch.quantity,
  quantity_after: batch.quantity,
  remarks: "初始演示入库",
  created_at: isoOffset(-12 + (index % 8), 11),
  reversed_operation_id: null,
  is_reverted: false,
}));
let qrScans: QrScanAuditItemDto[] = [];
let stocktakes: StocktakeTaskDto[] = [];
let stocktakeAuditLogs: StocktakeAuditLogDto[] = [];

function nextId(items: Array<{ id: number }>) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function findProduct(productId: number) {
  const product = products.find((item) => item.id === productId);
  if (!product) {
    throw new ApiClientError("not_found", 404);
  }
  return product;
}

function findBatch(batchId: number) {
  const batch = batches.find((item) => item.id === batchId);
  if (!batch) {
    throw new ApiClientError("not_found", 404);
  }
  return batch;
}

function updateBatchQuantity(batchId: number, nextQuantity: number) {
  const batch = findBatch(batchId);
  const product = findProduct(batch.product_id);
  const nextBatch = refreshBatch({ ...batch, quantity: formatQuantity(Math.max(0, nextQuantity)) }, product);
  batches = batches.map((item) => (item.id === batchId ? nextBatch : item));
  return nextBatch;
}

function listProducts(params: URLSearchParams) {
  const search = params.get("search")?.trim().toLowerCase() ?? "";
  const page = Number(params.get("page") ?? 1);
  const size = Number(params.get("size") ?? 20);
  const filtered = products
    .filter((product) => {
      if (!search) {
        return true;
      }
      return [product.product_name, product.barcode, product.manufacturer, product.category, product.location]
        .some((value) => value?.toLowerCase().includes(search));
    })
    .sort((left, right) => left.id - right.id);
  return paginate(filtered, page, size);
}

function createProduct(input: ProductMutationInput) {
  const barcode = input.barcode.trim();
  if (products.some((product) => product.barcode === barcode)) {
    throw new ApiClientError("conflict", 409);
  }
  const now = new Date().toISOString();
  const product: Product = {
    id: nextId(products),
    barcode,
    product_name: input.product_name.trim(),
    shelf_life_days: Number(input.shelf_life_days),
    location: input.location?.trim() || null,
    category: input.category?.trim() || null,
    unit: input.unit?.trim() || null,
    manufacturer: input.manufacturer.trim(),
    created_at: now,
    updated_at: now,
  };
  products = [product, ...products];
  return product;
}

function updateProduct(productId: number, input: Partial<ProductMutationInput>) {
  const existing = findProduct(productId);
  if (input.barcode && products.some((product) => product.id !== productId && product.barcode === input.barcode?.trim())) {
    throw new ApiClientError("conflict", 409);
  }
  const updated: Product = {
    ...existing,
    ...(input.barcode !== undefined ? { barcode: input.barcode.trim() } : {}),
    ...(input.product_name !== undefined ? { product_name: input.product_name.trim() } : {}),
    ...(input.shelf_life_days !== undefined ? { shelf_life_days: Number(input.shelf_life_days) } : {}),
    ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
    ...(input.category !== undefined ? { category: input.category?.trim() || null } : {}),
    ...(input.unit !== undefined ? { unit: input.unit?.trim() || null } : {}),
    ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer.trim() } : {}),
    updated_at: new Date().toISOString(),
  };
  products = products.map((product) => (product.id === productId ? updated : product));
  batches = batches.map((batch) => (batch.product_id === productId ? refreshBatch(batch, updated) : batch));
  return updated;
}

function listBatches(params: URLSearchParams) {
  const productId = params.get("product_id");
  const activeOnly = params.get("active_only") === "true";
  const expiredOnly = params.get("expired_only") === "true";
  const status = params.get("status");
  const page = Number(params.get("page") ?? 1);
  const size = Number(params.get("size") ?? 20);
  const currentBatches = batches.map((batch) => refreshBatch(batch, findProduct(batch.product_id)));
  batches = currentBatches;
  const filtered = currentBatches
    .filter((batch) => !productId || batch.product_id === Number(productId))
    .filter((batch) => !status || batch.status === status)
    .filter((batch) => !activeOnly || (batch.status !== "used_up" && parseQuantity(batch.quantity) > 0))
    .filter((batch) => !expiredOnly || batch.expiry_status === "expired")
    .sort((left, right) => new Date(left.expire_date ?? left.received_at).getTime() - new Date(right.expire_date ?? right.received_at).getTime());
  return paginate(filtered, page, size);
}

function createBatch(input: { product_id: number; batch_code?: string; manufacture_date: string; expire_date?: string | null; remarks?: string | null }) {
  const product = findProduct(input.product_id);
  const manufactureDate = input.manufacture_date;
  const expireDate = input.expire_date || addDays(manufactureDate, product.shelf_life_days);
  const batch = makeBatch({
    id: nextId(batches),
    product,
    quantity: 0,
    manufactureDate,
    expireDate,
    receivedAt: new Date().toISOString(),
    remarks: input.remarks?.trim() || null,
    batchCode: input.batch_code?.trim() || `IV${String(product.id).padStart(3, "0")}-${manufactureDate.replaceAll("-", "")}-${String(nextId(batches)).padStart(2, "0")}`,
  });
  batches = [batch, ...batches];
  return batch;
}

function createOperation(batchId: number, input: BatchOperationMutationInput | { operation_type: "adjust"; quantity: string; remarks?: string | null }) {
  const batch = findBatch(batchId);
  const currentQuantity = parseQuantity(batch.quantity);
  const delta = parseQuantity(input.quantity);
  const nextQuantity = input.operation_type === "add" ? currentQuantity + delta : input.operation_type === "adjust" ? delta : currentQuantity - delta;
  if (nextQuantity < 0) {
    throw new ApiClientError("conflict", 409);
  }
  const updatedBatch = updateBatchQuantity(batchId, nextQuantity);
  const operation: BatchOperationDto = {
    id: nextId(operations),
    batch_id: batchId,
    operation_type: input.operation_type,
    quantity: input.quantity.trim(),
    quantity_after: updatedBatch.quantity,
    remarks: input.remarks?.trim() || null,
    created_at: new Date().toISOString(),
    reversed_operation_id: null,
    is_reverted: false,
  };
  operations = [operation, ...operations];
  return { operation, batch: { id: updatedBatch.id, quantity: updatedBatch.quantity, status: updatedBatch.status } };
}

function revertOperation(batchId: number, operationId: number, remarks?: string | null) {
  const operation = operations.find((item) => item.id === operationId && item.batch_id === batchId);
  if (!operation || operation.is_reverted || operation.reversed_operation_id !== null) {
    throw new ApiClientError("conflict", 409);
  }
  const batch = findBatch(batchId);
  const currentQuantity = parseQuantity(batch.quantity);
  const quantity = parseQuantity(operation.quantity);
  const nextQuantity = operation.operation_type === "add" ? currentQuantity - quantity : currentQuantity + quantity;
  if (nextQuantity < 0) {
    throw new ApiClientError("conflict", 409);
  }
  const updatedBatch = updateBatchQuantity(batchId, nextQuantity);
  const reverse: BatchOperationDto = {
    id: nextId(operations),
    batch_id: batchId,
    operation_type: operation.operation_type === "add" ? "deduct" : "add",
    quantity: operation.quantity,
    quantity_after: updatedBatch.quantity,
    remarks: remarks?.trim() || "撤销演示操作",
    created_at: new Date().toISOString(),
    reversed_operation_id: operation.id,
    is_reverted: false,
  };
  operations = operations.map((item) => (item.id === operation.id ? { ...item, is_reverted: true } : item));
  operations = [reverse, ...operations];
  return { operation: reverse, batch: { id: updatedBatch.id, quantity: updatedBatch.quantity, status: updatedBatch.status } };
}

function dashboardOverview(): DashboardOverviewDto {
  const activeBatches = listBatches(new URLSearchParams({ active_only: "true", page: "1", size: "1000" })).items;
  const totalQuantity = activeBatches.reduce((sum, batch) => sum + parseQuantity(batch.quantity), 0);
  const nearExpiry = activeBatches.filter((batch) => batch.expiry_status === "critical" || batch.expiry_status === "warning");
  const expired = activeBatches.filter((batch) => batch.expiry_status === "expired");
  const healthy = activeBatches.filter((batch) => batch.expiry_status === "normal");
  const trend = Array.from({ length: 30 }, (_, index) => {
    const date = dateOffset(index);
    const expiring = activeBatches.filter((batch) => batch.expire_date === date);
    return {
      date,
      batch_count: expiring.length,
      quantity: formatQuantity(expiring.reduce((sum, batch) => sum + parseQuantity(batch.quantity), 0)),
    };
  });
  const categoryTotals = new Map<string, number>();
  activeBatches.forEach((batch) => {
    const product = findProduct(batch.product_id);
    const category = product.category ?? "未分类";
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + parseQuantity(batch.quantity));
  });
  return {
    current_inventory_quantity: formatQuantity(totalQuantity),
    near_expiry_batch_count: nearExpiry.length,
    expired_batch_count: expired.length,
    batch_health_rate: activeBatches.length ? healthy.length / activeBatches.length : 1,
    expiry_trend_30d: trend,
    category_inventory_distribution: [...categoryTotals.entries()].map(([category, quantity]) => ({
      category,
      batch_count: activeBatches.filter((batch) => findProduct(batch.product_id).category === category).length,
      quantity: formatQuantity(quantity),
      ratio: totalQuantity ? quantity / totalQuantity : 0,
    })),
    top_near_expiry_batches: [...nearExpiry, ...expired].slice(0, 8).map((batch) => ({
      ...batch,
      product: {
        ...batch.product,
        category: findProduct(batch.product_id).category,
        location: findProduct(batch.product_id).location,
      },
    })),
  };
}

function analyticsSummary(range: AnalyticsRange): AnalyticsSummaryDto {
  const months = range === "1m" ? 1 : range === "3m" ? 3 : range === "12m" ? 12 : 6;
  const now = today();
  const monthly = Array.from({ length: months }, (_, index) => {
    const date = new Date(now);
    date.setMonth(now.getMonth() - (months - 1 - index));
    const month = date.toISOString().slice(0, 7);
    const monthOperations = operations.filter((operation) => operation.created_at.startsWith(month));
    const inbound = monthOperations.filter((operation) => operation.operation_type === "add").reduce((sum, operation) => sum + parseQuantity(operation.quantity), 0);
    const loss = monthOperations.filter((operation) => operation.operation_type === "loss").reduce((sum, operation) => sum + parseQuantity(operation.quantity), 0);
    return { month, inventory_quantity: formatQuantity(inbound), loss_quantity: formatQuantity(loss) };
  });
  const categoryMap = new Map<string, { inbound: number; outbound: number; count: number }>();
  operations.forEach((operation) => {
    const batch = batches.find((item) => item.id === operation.batch_id);
    if (!batch) {
      return;
    }
    const category = findProduct(batch.product_id).category ?? "未分类";
    const item = categoryMap.get(category) ?? { inbound: 0, outbound: 0, count: 0 };
    item.count += 1;
    if (operation.operation_type === "add") {
      item.inbound += parseQuantity(operation.quantity);
    }
    if (operation.operation_type === "deduct" || operation.operation_type === "loss") {
      item.outbound += parseQuantity(operation.quantity);
    }
    categoryMap.set(category, item);
  });
  return {
    range,
    period: { start: dateOffset(-30 * months), end: dateOffset(0) },
    inventory_change_count: operations.length,
    current_month_loss_quantity: formatQuantity(operations.filter((operation) => operation.operation_type === "loss" && operation.created_at.startsWith(now.toISOString().slice(0, 7))).reduce((sum, operation) => sum + parseQuantity(operation.quantity), 0)),
    average_stock_age_days: 34.8,
    monthly_inventory_loss_trend: monthly,
    category_operation_summary: [...categoryMap.entries()].map(([category, item]) => ({
      category,
      inbound_quantity: formatQuantity(item.inbound),
      outbound_loss_quantity: formatQuantity(item.outbound),
      operation_count: item.count,
    })),
    high_risk_inventory_ranking: listBatches(new URLSearchParams({ active_only: "true", page: "1", size: "1000" })).items
      .filter((batch) => batch.expiry_status !== "normal")
      .slice(0, 10),
  };
}

function labelPayload(batchId: number): BatchLabelPayloadDto {
  const batch = findBatch(batchId);
  const product = findProduct(batch.product_id);
  return {
    batchCode: batch.batch_code,
    productName: product.product_name,
    barcode: product.barcode,
    quantity: batch.quantity,
    location: product.location,
    expireDate: batch.expire_date,
    qrCode: `initium-veris://batch/${batch.id}?code=${encodeURIComponent(batch.batch_code)}`,
  };
}

function scanStatus(batch: BatchDto | null): QrScanStatus {
  if (!batch) {
    return "not_found";
  }
  if (batch.expiry_status === "expired") {
    return "expired";
  }
  if (batch.expiry_status === "critical" || batch.expiry_status === "warning") {
    return "near_expiry";
  }
  return "valid";
}

function createQrScan(input: QrScanInput): QrScanResultDto {
  const qr = input.qr.trim();
  const idMatch = qr.match(/batch\/(\d+)/);
  const codeMatch = qr.match(/[?&]code=([^&]+)/);
  const batch = idMatch
    ? batches.find((item) => item.id === Number(idMatch[1])) ?? null
    : codeMatch
      ? batches.find((item) => item.batch_code === decodeURIComponent(codeMatch[1])) ?? null
      : batches.find((item) => item.batch_code === qr) ?? null;
  const status = scanStatus(batch);
  const result: QrScanAuditItemDto = {
    auditId: `SCAN-${Date.now()}-${qrScans.length + 1}`,
    batchCode: batch?.batch_code ?? null,
    productName: batch ? findProduct(batch.product_id).product_name : null,
    status,
    message: status === "valid" ? "批次有效" : status === "near_expiry" ? "批次临期，请优先处理" : status === "expired" ? "批次已过期" : "未找到批次凭证",
    expireDate: batch?.expire_date ?? null,
    remainingDays: batch?.days_until_expiry ?? null,
    clientScanId: input.clientScanId ?? null,
    scannedAt: input.scannedAt ?? new Date().toISOString(),
    scannerUser: DEMO_USER_DTO.username,
  };
  qrScans = [result, ...qrScans].slice(0, 120);
  return result;
}

function stocktakeUser() {
  return { id: 1, username: DEMO_USER_DTO.username, display: "Demo Veris" };
}

function toStocktakeProduct(product: Product) {
  return {
    id: product.id,
    barcode: product.barcode,
    product_name: product.product_name,
    category: product.category,
    location: product.location,
    unit: product.unit,
    manufacturer: product.manufacturer,
  };
}

function recalcStocktake(task: StocktakeTaskDto): StocktakeTaskDto {
  const items = task.items ?? [];
  const countedItems = items.filter((item) => item.status === "counted" || item.status === "recount_required" || item.status === "approved").length;
  const recountItems = items.filter((item) => item.status === "recount_required").length;
  const differenceItems = items.filter((item) => parseQuantity(item.difference_quantity) !== 0).length;
  const totalDifference = items.reduce((sum, item) => sum + parseQuantity(item.difference_quantity), 0);
  return {
    ...task,
    stats: {
      total_items: items.length,
      counted_items: countedItems,
      pending_items: items.length - countedItems,
      recount_items: recountItems,
      difference_items: differenceItems,
      total_difference_quantity: formatQuantity(totalDifference),
      progress: items.length ? countedItems / items.length : 0,
    },
    items,
  };
}

function buildStocktakeItem(taskId: number, batch: BatchDto): StocktakeItemDto {
  const product = findProduct(batch.product_id);
  return {
    id: Number(`${taskId}${String(batch.id).padStart(4, "0")}`),
    task_id: taskId,
    batch_id: batch.id,
    product_id: product.id,
    snapshot_quantity: batch.quantity,
    counted_quantity: null,
    difference_quantity: null,
    status: "pending",
    remarks: null,
    counted_by: null,
    counted_at: null,
    batch: { ...batch, product: toStocktakeProduct(product) },
    product: toStocktakeProduct(product),
  };
}

function selectBatchesForScope(scope: Record<string, unknown>) {
  const active = listBatches(new URLSearchParams({ active_only: "true", page: "1", size: "1000" })).items;
  const productIds = new Set((scope.product_ids as number[] | undefined) ?? []);
  const categories = new Set((scope.categories as string[] | undefined) ?? []);
  const locations = new Set((scope.locations as string[] | undefined) ?? []);
  const expiryStatuses = new Set((scope.expiry_statuses as string[] | undefined) ?? []);
  const hasScope = productIds.size > 0 || categories.size > 0 || locations.size > 0 || expiryStatuses.size > 0;
  if (!hasScope) {
    return active.slice(0, 8);
  }
  return active.filter((batch) => {
    const product = findProduct(batch.product_id);
    return productIds.has(product.id) || categories.has(product.category ?? "") || locations.has(product.location ?? "") || expiryStatuses.has(batch.expiry_status ?? "");
  });
}

function createStocktake(input: StocktakeCreateInput) {
  const taskId = nextId(stocktakes);
  const items = selectBatchesForScope(input.scope_config ?? {}).map((batch) => buildStocktakeItem(taskId, batch));
  const task = recalcStocktake({
    id: taskId,
    task_type: input.task_type,
    scope_config: input.scope_config ?? {},
    status: "draft",
    created_by: stocktakeUser(),
    submitted_by: null,
    approved_by: null,
    created_at: new Date().toISOString(),
    started_at: null,
    submitted_at: null,
    approved_at: null,
    stats: {
      total_items: 0,
      counted_items: 0,
      pending_items: 0,
      recount_items: 0,
      difference_items: 0,
      total_difference_quantity: "0",
      progress: 0,
    },
    items,
  });
  stocktakes = [task, ...stocktakes];
  return task;
}

function updateStocktake(task: StocktakeTaskDto) {
  const nextTask = recalcStocktake(task);
  stocktakes = stocktakes.map((item) => (item.id === task.id ? nextTask : item));
  return nextTask;
}

function findStocktake(taskId: number) {
  const task = stocktakes.find((item) => item.id === taskId);
  if (!task) {
    throw new ApiClientError("not_found", 404);
  }
  return task;
}

function updateStocktakeScope(taskId: number, input: Record<string, unknown>) {
  const task = findStocktake(taskId);
  const currentItems = task.items ?? [];
  const removeIds = new Set((input.remove_batch_ids as number[] | undefined) ?? []);
  let nextItems = currentItems.filter((item) => !removeIds.has(item.batch_id));
  const addBatchIds = new Set((input.add_batch_ids as number[] | undefined) ?? []);
  const scope: Record<string, unknown> = {
    product_ids: input.add_product_ids,
    categories: input.add_categories,
    locations: input.add_locations,
    expiry_statuses: input.add_expiry_statuses,
  };
  const candidateBatches = [
    ...batches.filter((batch) => addBatchIds.has(batch.id)),
    ...selectBatchesForScope(scope),
  ];
  candidateBatches.forEach((batch) => {
    if (!nextItems.some((item) => item.batch_id === batch.id)) {
      nextItems = [...nextItems, buildStocktakeItem(task.id, batch)];
    }
  });
  return updateStocktake({ ...task, items: nextItems });
}

function countStocktakeItem(taskId: number, itemId: number, input: { counted_quantity: string; status?: "counted" | "recount_required"; remarks?: string | null }) {
  const task = findStocktake(taskId);
  const item = task.items?.find((entry) => entry.id === itemId);
  if (!item) {
    throw new ApiClientError("not_found", 404);
  }
  const counted = parseQuantity(input.counted_quantity);
  const snapshot = parseQuantity(item.snapshot_quantity);
  const updatedItem: StocktakeItemDto = {
    ...item,
    counted_quantity: formatQuantity(counted),
    difference_quantity: formatQuantity(counted - snapshot),
    status: input.status ?? "counted",
    remarks: input.remarks?.trim() || null,
    counted_by: stocktakeUser(),
    counted_at: new Date().toISOString(),
  };
  updateStocktake({ ...task, items: (task.items ?? []).map((entry) => (entry.id === itemId ? updatedItem : entry)) });
  return updatedItem;
}

function transitionStocktake(taskId: number, status: StocktakeTaskStatus, remarks?: string | null) {
  const task = findStocktake(taskId);
  const now = new Date().toISOString();
  let nextTask: StocktakeTaskDto = { ...task, status };
  if (status === "active") {
    nextTask = { ...nextTask, started_at: now };
  }
  if (status === "submitted") {
    nextTask = { ...nextTask, submitted_at: now, submitted_by: stocktakeUser() };
  }
  if (status === "approved") {
    nextTask = { ...nextTask, approved_at: now, approved_by: stocktakeUser() };
    (nextTask.items ?? []).forEach((item) => {
      const counted = item.counted_quantity;
      if (counted !== null && parseQuantity(counted) !== parseQuantity(item.snapshot_quantity)) {
        createOperation(item.batch_id, { operation_type: "adjust", quantity: counted, remarks: remarks || "盘点审批调整" });
      }
    });
    nextTask = {
      ...nextTask,
      items: (nextTask.items ?? []).map((item) => ({ ...item, status: item.status === "pending" ? "approved" : "approved" })),
    };
  }
  if (status === "cancelled") {
    nextTask = { ...nextTask };
  }
  return updateStocktake(nextTask);
}

function listStocktakes(params: URLSearchParams) {
  const type = params.get("task_type") as StocktakeTaskType | null;
  const status = params.get("status") as StocktakeTaskStatus | null;
  const dateFrom = params.get("date_from") ?? "";
  const dateTo = params.get("date_to") ?? "";
  const filtered = stocktakes.filter((task) => {
    const taskDate = task.created_at.slice(0, 10);
    return (!type || task.task_type === type) && (!status || task.status === status) && (!dateFrom || taskDate >= dateFrom) && (!dateTo || taskDate <= dateTo);
  });
  return paginate(filtered, Number(params.get("page") ?? 1), Number(params.get("size") ?? 20));
}

function ok(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify({ code: 0, message: "ok", data }), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function fail(error: unknown) {
  const status = error instanceof ApiClientError ? error.status : 500;
  const message = error instanceof Error ? error.message : "request_failed";
  return new Response(JSON.stringify({ code: status, message, data: null }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readBody(init?: RequestInit) {
  if (!init?.body) {
    return {};
  }
  return JSON.parse(String(init.body));
}

function normalizePath(input: RequestInfo | URL) {
  const url = new URL(String(input));
  return url.pathname.replace(/^\/api/, "") || "/";
}

function seedStocktakeIfNeeded() {
  if (stocktakes.length > 0) {
    return;
  }
  const task = createStocktake({ task_type: "daily", scope_config: { expiry_statuses: ["warning", "critical", "expired"] } });
  updateStocktake({ ...task, status: "active", started_at: isoOffset(0, 9) });
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit) {
  seedStocktakeIfNeeded();
  const method = ((init?.method ?? "GET").toUpperCase() as HttpMethod);
  const url = new URL(String(input));
  const path = normalizePath(input);
  const body = await readBody(init);

  try {
    if (method === "GET" && path === "/auth/csrf") return ok({ csrf_token: "demo-csrf-token" });
    if (method === "POST" && path === "/auth/mobile-login") return ok({ ...DEMO_USER_DTO, auth_token: "demo-session-token", expires_in: 3600 });
    if (method === "POST" && path === "/auth/logout") return ok({ revoked: true });
    if (method === "GET" && path === "/auth/me") return ok(DEMO_USER_DTO);
    if (method === "GET" && path === "/auth/permissions") return ok({ items: PERMISSION_GROUPS, pagination: null });
    if (method === "GET" && path === "/auth/roles") return ok({ items: roles, pagination: null });
    if (method === "POST" && path === "/auth/roles") {
      const role = { id: nextId(roles), name: body.name.trim(), permissions: body.permission_codes ?? [] };
      roles = [role, ...roles];
      return ok(role);
    }
    const roleMatch = path.match(/^\/auth\/roles\/(\d+)$/);
    if (roleMatch && method === "PATCH") {
      const roleId = Number(roleMatch[1]);
      const role = { id: roleId, name: body.name.trim(), permissions: body.permission_codes ?? [] };
      roles = roles.map((item) => (item.id === roleId ? role : item));
      users = users.map((user) => ({ ...user, groups: user.groups.map((item) => (item.id === roleId ? role : item)) }));
      return ok(role);
    }
    if (roleMatch && method === "DELETE") {
      const roleId = Number(roleMatch[1]);
      if (users.some((user) => user.groups.some((role) => role.id === roleId))) throw new ApiClientError("conflict", 409);
      roles = roles.filter((role) => role.id !== roleId);
      return ok({ id: roleId });
    }
    if (method === "GET" && path === "/auth/users") return ok({ items: users, pagination: null });
    if (method === "POST" && path === "/auth/users") {
      const assignedRoles = roles.filter((role) => (body.group_ids ?? []).includes(role.id));
      const user: AuthAdminUser = {
        id: nextId(users),
        username: body.username.trim(),
        email: body.email.trim(),
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        is_active: body.is_active,
        is_staff: body.is_staff,
        is_superuser: false,
        groups: assignedRoles,
        direct_permissions: body.permission_codes ?? [],
        effective_permissions: Array.from(new Set([...assignedRoles.flatMap((role) => role.permissions), ...(body.permission_codes ?? [])])),
      };
      users = [user, ...users];
      return ok(user);
    }
    const userMatch = path.match(/^\/auth\/users\/(\d+)(\/password)?$/);
    if (userMatch && method === "PATCH") {
      const userId = Number(userMatch[1]);
      const assignedRoles = roles.filter((role) => (body.group_ids ?? []).includes(role.id));
      let updated: AuthAdminUser | null = null;
      users = users.map((user) => {
        if (user.id !== userId) return user;
        updated = {
          ...user,
          email: body.email.trim(),
          first_name: body.first_name.trim(),
          last_name: body.last_name.trim(),
          is_active: body.is_active,
          is_staff: body.is_staff,
          groups: assignedRoles,
          direct_permissions: body.permission_codes ?? [],
          effective_permissions: Array.from(new Set([...assignedRoles.flatMap((role) => role.permissions), ...(body.permission_codes ?? [])])),
        };
        return updated;
      });
      if (!updated) throw new ApiClientError("not_found", 404);
      return ok(updated);
    }
    if (userMatch && method === "POST" && userMatch[2]) return ok({ id: Number(userMatch[1]), password_reset: true });

    if (method === "GET" && path === "/products/categories") return ok({ items: Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(), pagination: null });
    if (method === "GET" && path === "/products") return ok(listProducts(url.searchParams));
    if (method === "POST" && path === "/products") return ok(createProduct(body));
    const productMatch = path.match(/^\/products\/(\d+)(\/batches)?$/);
    if (productMatch && !productMatch[2] && method === "GET") return ok(findProduct(Number(productMatch[1])));
    if (productMatch && !productMatch[2] && method === "PATCH") return ok(updateProduct(Number(productMatch[1]), body));
    if (productMatch && !productMatch[2] && method === "DELETE") {
      const productId = Number(productMatch[1]);
      products = products.filter((product) => product.id !== productId);
      batches = batches.filter((batch) => batch.product_id !== productId);
      return ok({ id: productId });
    }
    if (productMatch && productMatch[2] && method === "GET") {
      const params = new URLSearchParams(url.searchParams);
      params.set("product_id", productMatch[1]);
      return ok(listBatches(params));
    }

    if (method === "GET" && path === "/batches") return ok(listBatches(url.searchParams));
    if (method === "POST" && path === "/batches") return ok(createBatch(body));
    const batchOperationMatch = path.match(/^\/batches\/(\d+)\/operations(?:\/(\d+)\/revert)?$/);
    if (batchOperationMatch && method === "GET") {
      const batchId = Number(batchOperationMatch[1]);
      const operationType = url.searchParams.get("operation_type");
      const filtered = operations.filter((operation) => operation.batch_id === batchId && (!operationType || operation.operation_type === operationType));
      return ok(paginate(filtered, Number(url.searchParams.get("page") ?? 1), Number(url.searchParams.get("size") ?? 20)));
    }
    if (batchOperationMatch && method === "POST" && batchOperationMatch[2]) return ok(revertOperation(Number(batchOperationMatch[1]), Number(batchOperationMatch[2]), body.remarks));
    if (batchOperationMatch && method === "POST") return ok(createOperation(Number(batchOperationMatch[1]), body));
    const labelMatch = path.match(/^\/batches\/(\d+)\/label-payload$/);
    if (labelMatch && method === "GET") return ok(labelPayload(Number(labelMatch[1])));

    if (method === "GET" && path === "/dashboard/overview") return ok(dashboardOverview());
    if (method === "GET" && path === "/analytics/summary") return ok(analyticsSummary((url.searchParams.get("range") as AnalyticsRange) || "6m"));

    if (method === "GET" && path === "/qr-scans") return ok({ items: qrScans });
    if (method === "POST" && path === "/qr-scans") return ok(createQrScan(body));
    if (method === "POST" && path === "/qr-scans/bulk") return ok({ items: (body.items ?? []).map((item: QrScanInput) => createQrScan(item)) });

    if (method === "GET" && path === "/stocktakes") return ok(listStocktakes(url.searchParams));
    if (method === "POST" && path === "/stocktakes") return ok(createStocktake(body));
    const stocktakeMatch = path.match(/^\/stocktakes\/(\d+)(?:\/(scope|start|submit|approve|cancel|audit-logs|items\/(\d+)\/count))?$/);
    if (stocktakeMatch && method === "GET" && !stocktakeMatch[2]) return ok(findStocktake(Number(stocktakeMatch[1])));
    if (stocktakeMatch && method === "PATCH" && stocktakeMatch[2] === "scope") return ok(updateStocktakeScope(Number(stocktakeMatch[1]), body));
    if (stocktakeMatch && method === "POST" && stocktakeMatch[2] === "start") return ok(transitionStocktake(Number(stocktakeMatch[1]), "active"));
    if (stocktakeMatch && method === "POST" && stocktakeMatch[2] === "submit") return ok(transitionStocktake(Number(stocktakeMatch[1]), "submitted"));
    if (stocktakeMatch && method === "POST" && stocktakeMatch[2] === "approve") return ok(transitionStocktake(Number(stocktakeMatch[1]), "approved", body.remarks));
    if (stocktakeMatch && method === "POST" && stocktakeMatch[2] === "cancel") return ok(transitionStocktake(Number(stocktakeMatch[1]), "cancelled", body.remarks));
    if (stocktakeMatch && method === "GET" && stocktakeMatch[2] === "audit-logs") return ok({ items: stocktakeAuditLogs.filter((log) => log.task_id === Number(stocktakeMatch[1])), pagination: null });
    if (stocktakeMatch && method === "PATCH" && stocktakeMatch[2]?.startsWith("items/")) return ok(countStocktakeItem(Number(stocktakeMatch[1]), Number(stocktakeMatch[3]), body));

    throw new ApiClientError("not_found", 404);
  } catch (error) {
    return fail(error);
  }
}
