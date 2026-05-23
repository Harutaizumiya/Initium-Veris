export interface Product {
  id: number;
  barcode: string;
  product_name: string;
  shelf_life_days: number;
  location: string | null;
  category: string | null;
  unit: string | null;
  created_at: string;
  updated_at: string;
  manufacturer: string;
}

export interface ProductFormInput {
  barcode: string;
  product_name: string;
  shelf_life_days: string;
  location: string;
  category: string;
  unit: string;
  manufacturer: string;
}

export interface ProductFilters {
  category: string;
  location: string;
  unit: string;
  query: string;
}

export interface ProductListResult {
  items: Product[];
  page: number;
  size: number;
  total: number;
}
