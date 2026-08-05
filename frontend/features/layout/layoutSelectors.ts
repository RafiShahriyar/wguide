// frontend/features/layout/layoutSelectors.ts

import type { RootState } from "@/store/store";

export const selectPanels = (state: RootState) => state.layout.panels;
