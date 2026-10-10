import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
export function DocumentToc({
  title,
  headings,
}: {
  title: string;
  headings: { slug: string; text: string }[];
}) {
  return (
    <Accordion type="single" collapsible className="mobile-toc">
      <AccordionItem value="toc" className="border-0">
        <AccordionTrigger className="py-2 text-sm">{title}</AccordionTrigger>
        <AccordionContent>
          {headings.map((heading) => (
            <a key={heading.slug} href={`#${heading.slug}`}>
              {heading.text}
            </a>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
