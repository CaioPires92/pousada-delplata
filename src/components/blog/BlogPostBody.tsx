"use client";

import Image from "next/image";
import { BlogContentBlock } from "@/types/blog";
import { useCurrentDateKey } from "@/hooks/useCurrentDateKey";
import { slugifyHeading } from "@/lib/slugify-heading";

interface BlogPostBodyProps {
  content: BlogContentBlock[];
  /** A página mostra as fontes em uma caixa própria: então não repete no corpo. */
  hideSources?: boolean;
}

const headingFont = { fontFamily: "var(--font-bricolage), var(--font-inter), sans-serif" } as const;

export function BlogPostBody({ content, hideSources = false }: BlogPostBodyProps) {
  const currentDateKey = useCurrentDateKey();
  const visibleContent = currentDateKey
    ? content.filter((block) => !block.visibleUntil || currentDateKey <= block.visibleUntil)
    : content;
  const firstParagraphIndex = visibleContent.findIndex((block) => block.type === "paragraph");

  return (
    <div className="space-y-6 text-[1.05rem] leading-8 text-foreground/85">
      {visibleContent.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index} className={index === firstParagraphIndex ? "text-[1.2rem] leading-9 text-[color:var(--brand-forest)]" : undefined}>
              {block.content}
            </p>
          );
        }

        if (block.type === "heading") {
          const id = slugifyHeading(block.content);

          if (block.level === 3) {
            return (
              <h3 key={index} id={id} style={headingFont} className="scroll-mt-28 pt-4 text-[1.4rem] font-bold leading-tight tracking-tight text-[color:var(--brand-forest)]">
                {block.content}
              </h3>
            );
          }

          return (
            <h2 key={index} id={id} style={headingFont} className="scroll-mt-28 pt-8 text-[clamp(1.7rem,3vw,2.3rem)] font-bold leading-[1.08] tracking-tight text-[color:var(--brand-forest)]">
              {block.content}
            </h2>
          );
        }

        if (block.type === "image") {
          return (
            <figure key={index} className="space-y-2">
              <div className="relative aspect-[16/10] overflow-hidden bg-[color:var(--brand-forest)]">
                <Image src={block.src} alt={block.alt} fill sizes="(max-width: 1024px) 100vw, 720px" quality={82} className="object-cover" />
              </div>
              {block.caption || block.credit ? (
                <figcaption className="text-sm leading-6 text-foreground/65">
                  {block.caption}
                  {block.credit ? (
                    <span className="block text-xs">
                      Foto:{" "}
                      {block.credit.href ? (
                        <a href={block.credit.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary">
                          {block.credit.text}
                        </a>
                      ) : (
                        block.credit.text
                      )}
                    </span>
                  ) : null}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";

          return (
            <ListTag
              key={index}
              className={`space-y-3 ${block.ordered ? "list-decimal pl-6 marker:font-bold marker:text-[color:var(--brand-forest)]" : "list-none"}`}
            >
              {block.items.map((item) => (
                <li
                  key={item}
                  className={block.ordered ? "pl-1" : "relative pl-6 before:absolute before:left-0 before:top-[0.8em] before:h-2 before:w-2 before:bg-[color:var(--brand-gold)]"}
                >
                  {item}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "source") {
          if (hideSources) return null;

          return (
            <p key={index} className="text-sm leading-6 text-foreground/65">
              Fonte:{" "}
              <a
                href={block.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline decoration-secondary/60 underline-offset-4 hover:text-primary/75"
              >
                {block.label}
              </a>
            </p>
          );
        }

        return (
          <aside key={index} className="border-l-4 border-[color:var(--brand-gold)] bg-white px-5 py-4">
            {block.title ? (
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-forest)]">{block.title}</p>
            ) : null}
            <p className="text-[1rem] leading-7 text-foreground/85">{block.content}</p>
          </aside>
        );
      })}
    </div>
  );
}
