import type { ModuleManifest, SlotProps, MessageSlotProps } from "../types/module";

type SlotName = keyof NonNullable<ModuleManifest["slots"]>;

interface SlotRendererProps {
  modules: ModuleManifest[];
  slot: SlotName;
  props: SlotProps | MessageSlotProps;
}

export function SlotRenderer({ modules, slot, props }: SlotRendererProps) {
  const contributors = modules.filter((m) => m.slots?.[slot]);
  if (contributors.length === 0) return null;

  return (
    <>
      {contributors.map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Component = m.slots![slot] as React.FC<any>;
        return <Component key={m.id} {...props} />;
      })}
    </>
  );
}
