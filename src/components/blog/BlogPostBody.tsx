import { BlogContentBlock } from "@/types/blog";

interface BlogPostBodyProps {
  content: BlogContentBlock[];
}

export function BlogPostBody({ content }: BlogPostBodyProps) {
  const firstParagraphIndex = content.findIndex((block) => block.type === "paragraph");

  return (
    <div className="space-y-6 text-[1.02rem] leading-8 text-foreground/80">
      {content.map((block, index) => {
        if (block.type === "paragraph") {
          const isLeadParagraph = index === firstParagraphIndex;

          return (
            <p
              key={index}
              className={
                isLeadParagraph
                  ? "text-[1.08rem] first-letter:float-left first-letter:mr-2 first-letter:font-heading first-letter:font-semibold first-letter:text-5xl first-letter:leading-[0.85] first-letter:text-primary"
                  : undefined
              }
            >
              {block.content}
            </p>
          );
        }

        if (block.type === "heading") {
          const className =
            block.level === 3
              ? "border-t border-primary/10 pt-6 font-heading text-[2rem] font-semibold leading-tight text-primary"
              : "border-t border-primary/10 pt-8 font-heading text-[2.4rem] font-semibold leading-tight text-primary";

          if (block.level === 3) {
            return (
              <h3 key={index} className={className}>
                {block.content}
              </h3>
            );
          }

          return (
            <h2 key={index} className={className}>
              {block.content}
            </h2>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";

          return (
            <ListTag
              key={index}
              className={`space-y-3 border border-primary/10 bg-[color:var(--brand-cream)] px-6 py-5 ${
                block.ordered ? "list-decimal" : "list-disc"
              } list-inside`}
            >
              {block.items.map((item) => (
                <li key={item} className="pl-1 text-foreground/80 marker:text-primary">
                  {item}
                </li>
              ))}
            </ListTag>
          );
        }

        return (
          <aside
            key={index}
            className="border border-primary/10 bg-[color:var(--brand-cream)] px-5 py-4"
          >
            {block.title ? (
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-primary">
                {block.title}
              </p>
            ) : null}
            <p className="text-foreground/80">{block.content}</p>
          </aside>
        );
      })}
    </div>
  );
}
