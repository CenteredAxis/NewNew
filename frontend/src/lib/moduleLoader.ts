import type { ModuleManifest } from "../types/module";
import { registerNodeRenderer } from "./nodeRenderers";

/**
 * Vite glob-imports every file from src/modules/.
 * Each file must export a default ModuleManifest.
 *
 * Usage: drop a .tsx file into frontend/src/modules/ and it will
 * appear here automatically on the next hot-reload or build.
 */
const moduleFiles = import.meta.glob<{ default: ModuleManifest }>(
  "../modules/*.tsx",
  { eager: true }
);

export function loadModules(): ModuleManifest[] {
  const manifests: ModuleManifest[] = [];

  for (const [path, mod] of Object.entries(moduleFiles)) {
    const manifest = mod.default;
    if (!manifest || typeof manifest.id !== "string") {
      console.warn(`[modules] ${path} did not export a valid ModuleManifest`);
      continue;
    }
    // Register any custom node type renderers from this module
    if (manifest.nodeRenderers) {
      for (const [nodeType, component] of Object.entries(
        manifest.nodeRenderers
      )) {
        registerNodeRenderer(nodeType, component);
      }
    }

    manifests.push(manifest);
  }

  return manifests;
}
