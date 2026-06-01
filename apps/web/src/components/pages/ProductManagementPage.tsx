import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import {
  LoaderCircle,
  PackageSearch,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ApiClientError, createProduct, deleteProduct, listProductCategories, listProducts, queryKeys, updateProduct } from "../../api";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";
import { useNotification } from "../../providers/NotificationProvider";
import { Pagination } from "../common/Pagination";
import type { Product, ProductFilters, ProductFormInput } from "./ProductManagement.types";

const PAGE_SIZE = 8;

const EMPTY_FORM: ProductFormInput = {
  barcode: "",
  product_name: "",
  shelf_life_days: "",
  location: "",
  category: "",
  unit: "",
  manufacturer: "",
};

function formatDate(date: string) {
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeText(value: string | null) {
  return value?.trim() || "-";
}

function normalizeSearchValue(value: string | null) {
  return value?.trim().toLowerCase() || "";
}

function getUniqueOptions(values: Array<string | null>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).sort(
    (left, right) => left.localeCompare(right, "zh-CN"),
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    switch (error.message) {
      case "validation_error":
        return "请求参数不符合后端校验规则。";
      case "conflict":
        return "数据冲突，请检查条码是否重复。";
      case "not_found":
        return "目标数据不存在，可能已被其他人删除。";
      default:
        return `请求失败：${error.message}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "请求失败，请稍后重试。";
}

function getErrorDebugDetail(error: unknown) {
  if (error instanceof ApiClientError) {
    return `ApiClientError: status=${error.status}, code=${error.code ?? "null"}, message=${error.message}`;
  }

  if (error instanceof Error) {
    return error.stack || error.message;
  }

  return JSON.stringify(error);
}

function ProductFormModal({
  open,
  product,
  form,
  barcodeError,
  submitError,
  submitting,
  onChange,
  onClose,
  onDelete,
  onSubmit,
  canDelete,
}: {
  open: boolean;
  product: Product | null;
  form: ProductFormInput;
  barcodeError: string | null;
  submitError: string | null;
  submitting: boolean;
  onChange: (field: keyof ProductFormInput, value: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  canDelete: boolean;
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
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.section
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 24 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="ambient-shadow pointer-events-auto relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest"
            >
              <div className="flex items-start justify-between border-b border-surface-container-high px-8 py-6">
                <div>
                  <h3 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                    {product ? "编辑货物" : "新增货物"}
                  </h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    当前表单已切换到 Django 接口，提交会直接写入后端数据。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={onSubmit} className="space-y-6 px-8 py-8">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">条码 *</span>
                    <input
                      required
                      value={form.barcode}
                      onChange={(event) => onChange("barcode", event.target.value)}
                      className={cn(
                        "w-full rounded-2xl border bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15",
                        barcodeError ? "border-red-300" : "border-slate-200",
                      )}
                      placeholder="输入唯一条码"
                    />
                    {barcodeError ? <div className="text-xs font-semibold text-red-500">{barcodeError}</div> : null}
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">货物名称 *</span>
                    <input
                      required
                      value={form.product_name}
                      onChange={(event) => onChange("product_name", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                      placeholder="输入货物名称"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">厂商 *</span>
                    <input
                      required
                      value={form.manufacturer}
                      onChange={(event) => onChange("manufacturer", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                      placeholder="输入厂商名称"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">保质期天数 *</span>
                    <input
                      required
                      type="number"
                      min={1}
                      step={1}
                      value={form.shelf_life_days}
                      onChange={(event) => onChange("shelf_life_days", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                      placeholder="输入正整数"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">分类</span>
                    <input
                      value={form.category}
                      onChange={(event) => onChange("category", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                      placeholder="例如：乳制品"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-on-surface">库位</span>
                    <input
                      value={form.location}
                      onChange={(event) => onChange("location", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                      placeholder="例如：冷库 A-01"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-on-surface">单位</span>
                    <input
                      value={form.unit}
                      onChange={(event) => onChange("unit", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                      placeholder="例如：箱 / 瓶 / 包"
                    />
                  </label>
                </div>

                {submitError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                    {submitError}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-surface-container-high pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {product && canDelete ? (
                      <button
                        type="button"
                        onClick={onDelete}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-300 px-5 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        删除货物
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={submitting}
                      className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <LoaderCircle size={16} className="animate-spin" /> : null}
                      {product ? "保存修改" : "创建货物"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.section>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function DeleteConfirmModal({
  product,
  deleting,
  onCancel,
  onConfirm,
}: {
  product: Product | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!product) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
      <div className="ambient-shadow w-full max-w-md rounded-[2rem] border border-surface-container/10 bg-surface-container-lowest p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
          <Trash2 size={24} />
        </div>
        <h3 className="text-center font-headline text-2xl font-extrabold tracking-tight text-on-surface">删除货物</h3>
        <p className="mt-3 text-center text-sm leading-6 text-on-surface-variant">
          确认删除 <span className="font-bold text-on-surface">{product.product_name}</span> 吗？该操作会直接调用后端删除接口。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-300 px-5 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? <LoaderCircle size={16} className="animate-spin" /> : null}
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

export const ProductManagementPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreateProduct = hasPermission("products_create");
  const canUpdateProduct = hasPermission("products_update");
  const canDeleteProduct = hasPermission("products_delete");
  const [filters, setFilters] = useState<ProductFilters>({
    category: "",
    location: "",
    unit: "",
    query: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormInput>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const notify = useNotification();
  const deferredQuery = useDeferredValue(filters.query);
  const productListParams = useMemo(
    () => ({
      search: deferredQuery.trim(),
      page: currentPage,
      size: PAGE_SIZE,
    }),
    [currentPage, deferredQuery],
  );

  const productsQuery = useQuery({
    queryKey: queryKeys.products.list(productListParams),
    queryFn: () => listProducts(productListParams),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.products.categories(),
    queryFn: () => listProductCategories(),
  });
  const products = productsQuery.data?.items ?? [];
  const categoryOptionsFromApi = categoriesQuery.data ?? [];
  const isLoading = productsQuery.isLoading || categoriesQuery.isLoading;
  const errorMessage = productsQuery.error
    ? getErrorMessage(productsQuery.error)
    : categoriesQuery.error
      ? getErrorMessage(categoriesQuery.error)
      : mutationError;

  const categoryOptions = useMemo(
    () => getUniqueOptions([...categoryOptionsFromApi, ...products.map((product) => product.category)]),
    [categoryOptionsFromApi, products],
  );
  const locationOptions = useMemo(() => getUniqueOptions(products.map((product) => product.location)), [products]);
  const unitOptions = useMemo(() => getUniqueOptions(products.map((product) => product.unit)), [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = !filters.category || product.category === filters.category;
      const matchesLocation = !filters.location || product.location === filters.location;
      const matchesUnit = !filters.unit || product.unit === filters.unit;
      const matchesQuery =
        !deferredQuery.trim() ||
        normalizeSearchValue(product.product_name).includes(deferredQuery.trim().toLowerCase()) ||
        normalizeSearchValue(product.barcode).includes(deferredQuery.trim().toLowerCase()) ||
        normalizeSearchValue(product.manufacturer).includes(deferredQuery.trim().toLowerCase());

      return matchesCategory && matchesLocation && matchesUnit && matchesQuery;
    });
  }, [deferredQuery, filters.category, filters.location, filters.unit, products]);

  const hasLocalFilters = Boolean(filters.category || filters.location || filters.unit);
  const serverTotal = productsQuery.data?.pagination?.total ?? filteredProducts.length;
  const totalPages = hasLocalFilters ? 1 : Math.max(1, Math.ceil(serverTotal / PAGE_SIZE));
  const pagedProducts = filteredProducts;

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredQuery, filters.category, filters.location, filters.unit]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const openCreateModal = useCallback(() => {
    if (!canCreateProduct) {
      return;
    }
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setBarcodeError(null);
    setSubmitError(null);
    setIsFormOpen(true);
  }, [canCreateProduct]);

  const openEditModal = useCallback((product: Product) => {
    if (!canUpdateProduct) {
      return;
    }
    setEditingProduct(product);
    setBarcodeError(null);
    setSubmitError(null);
    setForm({
      barcode: product.barcode,
      product_name: product.product_name,
      shelf_life_days: String(product.shelf_life_days),
      location: product.location ?? "",
      category: product.category ?? "",
      unit: product.unit ?? "",
      manufacturer: product.manufacturer,
    });
    setIsFormOpen(true);
  }, [canUpdateProduct]);

  const resetFormModal = useCallback(() => {
    setIsFormOpen(false);
    setEditingProduct(null);
    setBarcodeError(null);
    setSubmitError(null);
    setForm(EMPTY_FORM);
  }, []);

  const closeFormModal = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    resetFormModal();
  }, [isSubmitting, resetFormModal]);

  const handleFormChange = useCallback((field: keyof ProductFormInput, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    if (field === "barcode") {
      setBarcodeError(null);
    }
    setSubmitError(null);
  }, []);

  const handleFilterChange = useCallback((field: keyof ProductFilters, value: string) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      category: "",
      location: "",
      unit: "",
      query: "",
    });
  }, []);

  const reloadAfterMutation = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.products.categories() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
  }, [queryClient]);

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingProduct ? !canUpdateProduct : !canCreateProduct) {
      setSubmitError("当前账号没有保存货物的权限。");
      return;
    }

    if (!form.barcode.trim() || !form.product_name.trim() || !form.manufacturer.trim() || !form.shelf_life_days.trim()) {
      return;
    }

    const shelfLife = Number(form.shelf_life_days);
    if (!Number.isInteger(shelfLife) || shelfLife <= 0) {
      setSubmitError("保质期天数必须是大于 0 的整数。");
      return;
    }

    const normalizedBarcode = form.barcode.trim();
    const duplicateBarcode = products.some(
      (product) => product.barcode === normalizedBarcode && product.id !== editingProduct?.id,
    );

    if (duplicateBarcode) {
      setBarcodeError("条码已存在，请使用唯一条码。");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setBarcodeError(null);
    setMutationError(null);

    try {
      const payload = {
        barcode: normalizedBarcode,
        product_name: form.product_name.trim(),
        shelf_life_days: shelfLife,
        location: form.location,
        category: form.category,
        unit: form.unit,
        manufacturer: form.manufacturer.trim(),
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        await createProduct(payload);
      }

      await reloadAfterMutation();
      notify.success({
        title: editingProduct ? "货物更新成功" : "货物创建成功",
        description: editingProduct
          ? `已更新 ${payload.product_name} 的货物信息。`
          : `已创建货物 ${payload.product_name}。`,
      });
      resetFormModal();
    } catch (error) {
      if (error instanceof ApiClientError && error.message === "conflict") {
        setBarcodeError("条码已存在，请使用唯一条码。");
      } else {
        setSubmitError(getErrorMessage(error));
      }
      notify.error({
        title: editingProduct ? "货物更新失败" : "货物创建失败",
        description: getErrorMessage(error),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [canCreateProduct, canUpdateProduct, editingProduct, form, notify, products, reloadAfterMutation, resetFormModal]);

  const handleDelete = useCallback(async () => {
    if (!productToDelete) {
      return;
    }
    if (!canDeleteProduct) {
      setMutationError("当前账号没有删除货物的权限。");
      return;
    }

    setIsDeleting(true);
    setMutationError(null);

    try {
      await deleteProduct(productToDelete.id);
      await reloadAfterMutation();
      notify.success({
        title: "货物删除成功",
        description: `已删除货物 ${productToDelete.product_name}。`,
      });
      if (editingProduct?.id === productToDelete.id) {
        closeFormModal();
      }
      setProductToDelete(null);
    } catch (error) {
      setMutationError(getErrorMessage(error));
      notify.error({
        title: "货物删除失败",
        description: getErrorMessage(error),
        debugDetail: getErrorDebugDetail(error),
      });
    } finally {
      setIsDeleting(false);
    }
  }, [canDeleteProduct, closeFormModal, editingProduct?.id, notify, productToDelete, reloadAfterMutation]);

  const openDeleteConfirm = useCallback((product: Product) => {
    setProductToDelete(product);
  }, []);

  const openEditingProductDeleteConfirm = useCallback(() => {
    if (editingProduct && canDeleteProduct) {
      openDeleteConfirm(editingProduct);
    }
  }, [canDeleteProduct, editingProduct, openDeleteConfirm]);

  const closeDeleteConfirm = useCallback(() => {
    if (!isDeleting) {
      setProductToDelete(null);
    }
  }, [isDeleting]);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">货物管理</h2>
          <p className="mt-1 text-on-surface-variant">当前页面已接入 Django `products` 接口，支持查询、新增、编辑与删除。</p>
        </div>
        {canCreateProduct ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
          >
            <Plus size={18} />
            新增货物
          </button>
        ) : null}
      </div>

      <section className="ambient-shadow mb-8 rounded-3xl border border-surface-container/10 bg-surface-container-lowest p-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_repeat(3,minmax(0,0.55fr))_auto]">
          <label className="relative">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={filters.query}
              onChange={(event) => handleFilterChange("query", event.target.value)}
              placeholder="搜索货物名称、条码或厂商"
              className="w-full rounded-2xl border border-slate-200 bg-surface-container-low py-3 pl-11 pr-4 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <select
            value={filters.category}
            onChange={(event) => handleFilterChange("category", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="">全部分类</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={filters.location}
            onChange={(event) => handleFilterChange("location", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="">全部库位</option>
            {locationOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={filters.unit}
            onChange={(event) => handleFilterChange("unit", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="">全部单位</option>
            {unitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <RotateCcw size={16} />
            重置筛选
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <section className="ambient-shadow overflow-hidden rounded-3xl border border-surface-container/10 bg-surface-container-lowest">
        <div className="flex flex-col gap-3 border-b border-surface-container-high p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-headline text-xl font-bold text-on-surface">货物列表</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {isLoading
                ? "正在从后端拉取数据..."
                : hasLocalFilters
                  ? `当前页筛选结果共 ${filteredProducts.length} 条货物记录。`
                  : `当前筛选结果共 ${serverTotal} 条货物记录。`}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
            {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : <PackageSearch size={16} />}
            接口来源：`/api/products`
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <LoaderCircle size={28} className="animate-spin text-on-surface-variant" />
            <div>
              <h4 className="text-lg font-bold text-on-surface">正在同步货物数据</h4>
              <p className="mt-1 text-sm text-on-surface-variant">请确认 Django 服务已启动，并且 `VITE_API_BASE_URL` 配置正确。</p>
            </div>
          </div>
        ) : pagedProducts.length > 0 ? (
          <>
            <div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">货物名称</th>
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">条码</th>
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">厂商</th>
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">分类</th>
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">库位</th>
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">单位</th>
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">保质期天数</th>
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">更新时间</th>
                    <th className="px-8 py-4 text-right text-xs font-bold uppercase tracking-wider text-on-surface-variant">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {pagedProducts.map((product) => (
                    <tr key={product.id} className="transition-colors hover:bg-surface-container-low/30">
                      <td className="px-8 py-5">
                        <div className="font-bold text-on-surface">{product.product_name}</div>
                      </td>
                      <td className="px-8 py-5 text-sm font-mono text-on-surface-variant">{product.barcode}</td>
                      <td className="px-8 py-5 text-sm text-on-surface-variant">{product.manufacturer}</td>
                      <td className="px-8 py-5 text-sm text-on-surface-variant">{normalizeText(product.category)}</td>
                      <td className="px-8 py-5 text-sm text-on-surface-variant">{normalizeText(product.location)}</td>
                      <td className="px-8 py-5 text-sm text-on-surface-variant">{normalizeText(product.unit)}</td>
                      <td className="px-8 py-5 text-sm font-semibold text-on-surface">{product.shelf_life_days} 天</td>
                      <td className="px-8 py-5 text-sm text-on-surface-variant">{formatDate(product.updated_at)}</td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end">
                          {canUpdateProduct ? (
                          <div className="group relative">
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-on-surface transition-all hover:border-primary/20 hover:bg-surface-container-low"
                              aria-label={`编辑 ${product.product_name}`}
                              title={`编辑 ${product.product_name}`}
                            >
                              <Pencil size={14} className="shrink-0" />
                            </button>
                            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 min-w-max -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                              编辑
                            </span>
                          </div>
                          ) : (
                            <span className="text-sm text-on-surface-variant">只读</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-8 pb-8 pt-6">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
              <PackageSearch size={28} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-on-surface">未找到匹配的货物</h4>
              <p className="mt-1 text-sm text-on-surface-variant">可以尝试调整搜索关键词或重置筛选条件。</p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
            >
              重置筛选
            </button>
          </div>
        )}
      </section>

      <ProductFormModal
        open={isFormOpen}
        product={editingProduct}
        form={form}
        barcodeError={barcodeError}
        submitError={submitError}
        submitting={isSubmitting}
        onChange={handleFormChange}
        onClose={closeFormModal}
        onDelete={openEditingProductDeleteConfirm}
        onSubmit={handleSubmit}
        canDelete={canDeleteProduct}
      />

      <DeleteConfirmModal
        product={productToDelete}
        deleting={isDeleting}
        onCancel={closeDeleteConfirm}
        onConfirm={handleDelete}
      />
    </>
  );
};
