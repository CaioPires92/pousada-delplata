"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

const fieldClass =
    "w-full rounded-none border border-[color:var(--line-dark)] bg-[color:var(--brand-white)] px-4 py-3 text-[1rem] text-[color:var(--brand-forest)] outline-none transition-colors placeholder:text-[color:var(--brand-forest)]/45 focus:border-[color:var(--brand-gold)] focus:ring-2 focus:ring-[color:var(--brand-gold)]/30";
const labelClass = "text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[color:var(--brand-forest)]";

export function ContactForm() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
        website: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            setLoading(false);
            if (res.ok) {
                setSuccess(true);
                setFormData({ name: "", email: "", phone: "", subject: "", message: "", website: "" });
                setTimeout(() => setSuccess(false), 5000);
            } else {
                setError('Não foi possível enviar a mensagem. Tente novamente ou fale pelo WhatsApp.');
            }
        } catch {
            setLoading(false);
            setError('Sem conexão no momento. Tente novamente ou fale pelo WhatsApp.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="hidden" aria-hidden="true">
                <label htmlFor="website">Não preencha este campo</label>
                <input id="website" type="text" tabIndex={-1} autoComplete="off" value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label htmlFor="name" className={labelClass}>Nome completo</label>
                    <input
                        type="text"
                        id="name"
                        required
                        className={fieldClass}
                        placeholder="Seu nome"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="phone" className={labelClass}>Telefone ou WhatsApp</label>
                    <input
                        type="tel"
                        id="phone"
                        required
                        className={fieldClass}
                        placeholder="(00) 00000-0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="email" className={labelClass}>E-mail</label>
                <input
                    type="email"
                    id="email"
                    required
                    className={fieldClass}
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="subject" className={labelClass}>Assunto</label>
                <select
                    id="subject"
                    className={fieldClass}
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                >
                    <option value="">Selecione um assunto</option>
                    <option value="reservas">Reservas</option>
                    <option value="eventos">Eventos</option>
                    <option value="duvidas">Dúvidas gerais</option>
                    <option value="outros">Outros</option>
                </select>
            </div>

            <div className="space-y-2">
                <label htmlFor="message" className={labelClass}>Mensagem</label>
                <textarea
                    id="message"
                    required
                    rows={5}
                    className={`${fieldClass} resize-none`}
                    placeholder="Como podemos ajudar?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
            </div>

            {error ? (
                <p role="alert" className="border-l-4 border-[#8A2F2A] bg-[#8A2F2A]/6 px-4 py-3 text-sm text-[#8A2F2A]">{error}</p>
            ) : null}
            {success ? (
                <p role="status" className="border-l-4 border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-4 py-3 text-sm text-[color:var(--brand-forest)]">
                    Mensagem enviada! Nossa equipe responde o mais breve possível.
                </p>
            ) : null}

            <Button
                type="submit"
                className="h-12 w-full rounded-none bg-[color:var(--brand-forest)] text-sm font-bold uppercase tracking-[0.12em] text-white hover:bg-[color:var(--brand-forest)] hover:opacity-90"
                disabled={loading}
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                    </>
                ) : success ? (
                    "Mensagem enviada"
                ) : (
                    <>
                        Enviar mensagem
                        <Send className="ml-2 h-4 w-4" />
                    </>
                )}
            </Button>
        </form>
    );
}
