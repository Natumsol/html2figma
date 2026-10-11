import { useEffect, useRef, useState } from "react";
import { Select } from "radix-ui";
import { Check, ChevronDown, Layers, Monitor } from "lucide-react";
export function ExampleSelect({
  id,
  label,
  options,
  kind = "example",
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  kind?: "example" | "viewport";
}) {
  const [value, setValue] = useState(options[0]?.value || "");
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setReady(true);
    const element = input.current!;
    const sync = () => setValue(element.value);
    element.addEventListener("change", sync);
    return () => element.removeEventListener("change", sync);
  }, []);
  const Icon = kind === "viewport" ? Monitor : Layers;
  function choose(next: string) {
    setValue(next);
    // Keep the browser conversion controller independent of React hydration.
    if (input.current) {
      input.current.value = next;
      input.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  return (
    <>
      <input ref={input} id={id} type="hidden" value={value} readOnly />
      <Select.Root value={value} onValueChange={choose} disabled={!ready}>
        <Select.Trigger
          id={`${id}-trigger`}
          className="case-select-trigger"
          aria-label={label}
        >
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={15} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="case-select-menu"
            position="popper"
            align="end"
            sideOffset={8}
            collisionPadding={16}
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  className="case-select-item"
                  value={option.value}
                  key={option.value}
                >
                  <Icon size={16} aria-hidden="true" />
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="case-select-check">
                    <Check size={16} aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </>
  );
}
