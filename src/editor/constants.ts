/**
 * Debounce interval before autosave fires after the last edit — see design
 * decision D3 and the open question it left in design.md. Two seconds is
 * conservative: short enough that a crash loses at most a couple of
 * seconds of typing, long enough that an ordinary pause between words
 * does not trigger a write. Explicit save (Mod-S) always bypasses this.
 */
export const AUTOSAVE_DEBOUNCE_MS = 2000;
