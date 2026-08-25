"use client";

import Image from "next/image";
import { BlogContentBlock } from "@/types/blog";
import { useCurrentDateKey } from "@/hooks/useCurrentDateKey";

interface BlogPostBodyProps {
  content: BlogContentBlock[];
}

export function BlogPostBody({ content }: BlogPostBodyProps) {
  const currentDateKey = useCurrentDateKey();
  const visibleContent = currentDateKey
    ? content.filter((block) => !block.visibleUntil || currentDateKey <= block.visibleUntil)
    : content;
  const firstParagraphIndex = visibleContent.findIndex((block) => block.type === "paragraph");

  return (
    <div className="space-y-6 text-[1.02rem] leading-8 text-foreground/80">
      {visibleContent.map((block, index) => {
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

        if (block.type === "image") {
          return (
            <figure key={index} className="space-y-3">
              <div className="relative overflow-hidden border border-primary/10 bg-primary/5">
                <div className="relative aspect-[16/10]">
                  <Image
                    src={block.src}
                    alt={block.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 720px"
                    className="object-cover"
                  />
                </div>
              </div>
              {block.caption ? (
                <figcaption className="text-sm leading-6 text-foreground/62">
                  {block.caption}
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

        if (block.type === "source") {
          return (
            <p key={index} className="text-sm leading-6 text-foreground/65">
              Fonte:{' '}
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
