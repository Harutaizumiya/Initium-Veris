import type { Product } from "../components/pages/ProductManagement.types";
import { requestJson } from "./client";
import type { ApiListData } from "./types";

export interface ProductDto {
  id: number;
  barcode: string;
  product_name: string;
  shelf_life_days: number;
  location: string | null;
  category: string | null;
  unit: string | null;
  manufacturer: string;
  created_at: string;
  updated_at: string;
}

export interface ProductListParams {
  search?: string;
  page?: number;
  size?: number;
}

export interface ProductMutationInput {
  barcode: string;
  product_name: string;
  shelf_life_days: number;
  location?: string | null;
  category?: string | null;
  unit?: string | null;
  manufacturer: string;
}

export function toProduct(dto: ProductDto): Product {
  return {
    id: dto.id,
    barcode: dto.barcode,
    product_name: dto.product_name,
    shelf_life_days: dto.shelf_life_days,
    location: dto.location,
    category: dto.category,
    unit: dto.unit,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
    manufacturer: dto.manufacturer,
  };
}

function buildQuery(params: ProductListParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.page) {
    searchParams.set("page", String(params.page));
  }
  if (params.size) {
    searchParams.set("size", String(params.size));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function normalizeMutationInput(input: ProductMutationInput) {
  return {
    barcode: input.barcode.trim(),
    product_name: input.product_name.trim(),
    shelf_life_days: input.shelf_life_days,
    location: input.location?.trim() || null,
    category: input.category?.trim() || null,
    unit: input.unit?.trim() || null,
    manufacturer: input.manufacturer.trim(),
  };
}

export async function listProducts(params: ProductListParams = {}) {
  const data = await requestJson<ApiListData<ProductDto>>(`/products${buildQuery(params)}`);
  return {
    items: data.items.map(toProduct),
    pagination: data.pagination,
  };
}

export async function getProduct(productId: number) {
  const data = await requestJson<ProductDto>(`/products/${productId}`);
  return toProduct(data);
}

export async function createProduct(input: ProductMutationInput) {
  const data = await requestJson<ProductDto>("/products", {
    method: "POST",
    body: normalizeMutationInput(input),
  });
  return toProduct(data);
}

export async function updateProduct(productId: number, input: Partial<ProductMutationInput>) {
  const data = await requestJson<ProductDto>(`/products/${productId}`, {
    method: "PATCH",
    body: {
      ...(input.barcode !== undefined ? { barcode: input.barcode.trim() } : {}),
      ...(input.product_name !== undefined ? { product_name: input.product_name.trim() } : {}),
      ...(input.shelf_life_days !== undefined ? { shelf_life_days: input.shelf_life_days } : {}),
      ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
      ...(input.category !== undefined ? { category: input.category?.trim() || null } : {}),
      ...(input.unit !== undefined ? { unit: input.unit?.trim() || null } : {}),
      ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer.trim() } : {}),
    },
  });
  return toProduct(data);
}

export async function deleteProduct(productId: number) {
  return requestJson<{ id: number }>(`/products/${productId}`, {
    method: "DELETE",
  });
}

export async function listProductCategories(search?: string) {
  const query = search?.trim() ? `?${new URLSearchParams({ search: search.trim() }).toString()}` : "";
  const data = await requestJson<ApiListData<string>>(`/products/categories${query}`);
  return data.items;
}
