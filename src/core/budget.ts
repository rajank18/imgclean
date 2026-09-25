import type {
  DiscoveredImageFile,
  ImageAnalysis,
  BudgetStatus,
  ImgCleanBudgetsConfig,
} from '../types/index.js';
import { parseBytes } from '../utils/bytes.js';

/**
 * Check total project and individual image size against configured budgets
 */
export function checkBudget(
  images: Array<DiscoveredImageFile | ImageAnalysis>,
  budgetsConfig?: ImgCleanBudgetsConfig
): BudgetStatus | undefined {
  if (!budgetsConfig || (!budgetsConfig.total && !budgetsConfig.single)) {
    return undefined;
  }

  const totalSize = images.reduce((acc, img) => acc + img.size, 0);

  let totalBudget: number | undefined;
  let passedTotal = true;

  if (budgetsConfig.total) {
    totalBudget = parseBytes(budgetsConfig.total);
    passedTotal = totalSize <= totalBudget;
  }

  let singleBudget: number | undefined;
  let passedSingle = true;
  const exceededSingleFiles: Array<{ file: string; size: number; budget: number }> = [];

  if (budgetsConfig.single) {
    singleBudget = parseBytes(budgetsConfig.single);
    for (const img of images) {
      if (img.size > singleBudget) {
        exceededSingleFiles.push({
          file: img.path,
          size: img.size,
          budget: singleBudget,
        });
      }
    }
    passedSingle = exceededSingleFiles.length === 0;
  }

  const passed = passedTotal && passedSingle;

  return {
    totalBudget,
    totalSize,
    passedTotal,
    singleBudget,
    exceededSingleFiles,
    passedSingle,
    passed,
  };
}
