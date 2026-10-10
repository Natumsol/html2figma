import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { CodeCopy } from "./CodeCopy";
export function SchemaDisclosure({
  title,
  declarations,
  chinese,
}: {
  title: string;
  declarations: string;
  chinese: boolean;
}) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="schema" className="border-0">
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent forceMount>
          <div className="code-block">
            <div className="code-block-bar">
              <CodeCopy
                code={declarations}
                language="TYPESCRIPT"
                chinese={chinese}
              />
            </div>
            <pre data-managed-code>
              <code>{declarations}</code>
            </pre>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
