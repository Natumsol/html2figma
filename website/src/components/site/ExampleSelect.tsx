import { NativeSelect, NativeSelectOption } from "../ui/native-select";
export function ExampleSelect({
  id,
  options,
}: {
  id: string;
  options: { value: string; label: string }[];
}) {
  return (
    <NativeSelect
      id={id}
      className="h-auto rounded-xl border-0 bg-white py-2.5 pr-9 shadow-none"
    >
      {options.map((option) => (
        <NativeSelectOption value={option.value} key={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
