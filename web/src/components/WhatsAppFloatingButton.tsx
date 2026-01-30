'use client';

import Link from 'next/link';

const WHATSAPP_URL =
    'https://wa.me/5519999654866?text=Ol%C3%A1!%20Gostaria%20de%20informa%C3%A7%C3%B5es,%20por%20favor.';

export default function WhatsAppFloatingButton() {
    return (
        <div className="fixed bottom-5 right-5 z-50">
            <div className="relative group">
                <span className="pointer-events-none absolute right-0 bottom-[72px] hidden whitespace-nowrap rounded-md bg-black/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block">
                    Falar no WhatsApp
                </span>

                <Link
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Falar no WhatsApp"
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg outline-none ring-offset-background transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:scale-[1.05] motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path
                            fill="currentColor"
                            d="M19.11 17.47c-.27-.13-1.6-.79-1.85-.88-.25-.09-.43-.13-.61.13-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.13-1.14-.42-2.17-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.13-.61-1.47-.84-2.02-.22-.53-.44-.46-.61-.47l-.52-.01c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3 0 1.36.99 2.67 1.13 2.85.14.18 1.95 2.98 4.73 4.18.66.29 1.17.46 1.57.59.66.21 1.26.18 1.73.11.53-.08 1.6-.65 1.82-1.27.22-.62.22-1.15.16-1.27-.07-.12-.25-.2-.52-.34Z"
                        />
                        <path
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M16.02 3C9.4 3 4 8.27 4 14.75c0 2.21.62 4.26 1.7 6.03L4.57 25.8a1 1 0 0 0 1.22 1.22l5.12-1.12a12.3 12.3 0 0 0 5.11 1.1c6.62 0 12.02-5.27 12.02-11.75C28.04 8.27 22.64 3 16.02 3Zm0 21.94c-1.72 0-3.32-.44-4.72-1.22a1 1 0 0 0-.7-.1l-3.56.78.78-3.56a1 1 0 0 0-.1-.7 10.62 10.62 0 0 1-1.25-5.39c0-5.38 4.56-9.75 10.2-9.75 5.64 0 10.2 4.37 10.2 9.75s-4.56 9.75-10.2 9.75Z"
                        />
                    </svg>
                </Link>
            </div>
        </div>
    );
}

