import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * User settings. Peripheral state only, like the session store: nothing here
 * describes document content.
 */
export interface SettingsState {
	/**
	 * Whether typed Markdown syntax converts into formatting — the single
	 * opt-out of design decision D3. Read by the editor on every keystroke, so
	 * a change applies immediately.
	 */
	inputRulesEnabled: boolean;
	outlineOpen: boolean;

	setInputRulesEnabled(enabled: boolean): void;
	setOutlineOpen(open: boolean): void;
}

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			inputRulesEnabled: true,
			outlineOpen: true,

			setInputRulesEnabled(enabled) {
				set({ inputRulesEnabled: enabled });
			},
			setOutlineOpen(open) {
				set({ outlineOpen: open });
			},
		}),
		{
			name: "markflow-settings",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
