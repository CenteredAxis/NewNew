import type { ModuleManifest } from "../types/module";
import type { SlotProps, MessageSlotProps } from "../types/module";

type SlotName = keyof NonNullable<ModuleManifest["slots"]>;

interface SlotRendererProps<S extends SlotName> {
  modules: ModuleManifest[];
  slot: S;
  props: S extends "messageActions" ? MessageSlotProps : SlotProps;
}

export function SlotRenderer<S extends SlotName>({
  modules,
  slot,
  props,
}: SlotRendererProps<S>) {
  const contributors = modules.filter((m) => m.slots?.[slot]);
  if (contributors.length === 0) return null;

  return (
    <>
      {contributors.map((m) => {
        const Component = m.slots![slot] as React.FC<
          S extends "messageActions" ? MessageSlotProps : SlotProps
        >;
        return <Component key={m.id} {...(props as never)} />;
      })}
    </>
  );
}
