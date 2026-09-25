import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeName = "dark" | "light" | "sepia";

export interface AppearanceState {
	theme: ThemeName;
	setTheme(theme: ThemeName): void;
}

export const useAppearanceStore = create<AppearanceState>()(persist((set) => ({
	theme: "dark",
	setTheme(theme) { set({ theme }); },
}), {
	name: "markflow-appearance",
	storage: createJSONStorage(() => localStorage),
}));
