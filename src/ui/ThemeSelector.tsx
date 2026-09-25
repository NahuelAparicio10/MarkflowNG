import { useAppearanceStore, type ThemeName } from "../store/appearance";
import { PaletteIcon } from "./icons";

export default function ThemeSelector() {
	const theme = useAppearanceStore((state) => state.theme);
	const setTheme = useAppearanceStore((state) => state.setTheme);
	return (
		<details className="markflow-theme-menu">
			<summary className="markflow-icon-button" aria-label="Appearance" title="Appearance"><PaletteIcon /></summary>
			<label className="markflow-theme-control">
				<span>Appearance</span>
				<select aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)}>
				<option value="dark">Dark</option>
				<option value="light">Light</option>
				<option value="sepia">Sepia</option>
				</select>
			</label>
		</details>
	);
}
