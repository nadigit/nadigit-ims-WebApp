import { TranslateService } from '@ngx-translate/core';

/** Maps API costing method enum values to i18n keys (see costing_method_* in locale files). */
const COSTING_METHOD_I18N_KEYS: Record<string, string> = {
  FIFO: 'costing_method_fifo',
  LIFO: 'costing_method_lifo',
  WEIGHTED_AVERAGE: 'costing_method_weighted_average',
  STANDARD_COST: 'costing_method_standard_cost',
  NONE: 'costing_method_none',
  AVERAGE: 'costing_method_average',
};

export type EffectiveCostingSource = 'product' | 'category' | 'organization' | 'none';

export interface ResolvedEffectiveCosting {
  method: string | null;
  source: EffectiveCostingSource;
}

export function costingMethodTranslationKey(method: string | null | undefined): string {
  if (!method) {
    return '';
  }
  return COSTING_METHOD_I18N_KEYS[method] ?? method;
}

export function getCostingMethodDisplayLabel(
  translate: TranslateService,
  method: string | null | undefined
): string {
  if (!method || method === 'NONE') {
    return translate.instant('costing_method_none');
  }
  const key = costingMethodTranslationKey(method);
  return key ? translate.instant(key) : method;
}

/** Resolves effective costing using product → category → organization hierarchy. */
export function resolveEffectiveCosting(input: {
  productCostingMethod?: string | null;
  categoryCostingMethod?: string | null;
  warehouseOrganizationCostingMethod?: string | null;
  organizationCostingMethod?: string | null;
}): ResolvedEffectiveCosting {
  const productMethod = input.productCostingMethod;
  if (productMethod && productMethod !== 'NONE') {
    return { method: productMethod, source: 'product' };
  }

  const categoryMethod = input.categoryCostingMethod;
  if (categoryMethod && categoryMethod !== 'NONE') {
    return { method: categoryMethod, source: 'category' };
  }

  const warehouseOrgMethod = input.warehouseOrganizationCostingMethod;
  const orgMethod =
    warehouseOrgMethod && warehouseOrgMethod !== 'NONE'
      ? warehouseOrgMethod
      : input.organizationCostingMethod && input.organizationCostingMethod !== 'NONE'
        ? input.organizationCostingMethod
        : null;

  if (orgMethod) {
    return { method: orgMethod, source: 'organization' };
  }

  return { method: null, source: 'none' };
}
