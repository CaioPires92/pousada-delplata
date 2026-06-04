"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

export function ContactForm() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            setLoading(false);
            if (res.ok) {
                setSuccess(true);
                setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
                setTimeout(() => setSuccess(false), 5000);
            } else {
                alert('Falha ao enviar. Tente novamente.');
            }
        } catch {
            setLoading(false);
            alert('Erro de rede. Tente novamente.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 border border-primary/10 bg-white p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label htmlFor="name" className="font-sans text-sm font-medium text-primary">Nome Completo</label>
                    <input
                        type="text"
                        id="name"
                        required
                        className="w-full border border-primary/10 bg-[color:var(--brand-white)] px-4 py-3 outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                        placeholder="Seu nome"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="phone" className="font-sans text-sm font-medium text-primary">Telefone / WhatsApp</label>
                    <input
                        type="tel"
                        id="phone"
                        required
                        className="w-full border border-primary/10 bg-[color:var(--brand-white)] px-4 py-3 outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                        placeholder="(00) 00000-0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="email" className="font-sans text-sm font-medium text-primary">E-mail</label>
                <input
                    type="email"
                    id="email"
                    required
                    className="w-full border border-primary/10 bg-[color:var(--brand-white)] px-4 py-3 outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="subject" className="font-sans text-sm font-medium text-primary">Assunto</label>
                <select
                    id="subject"
                    className="w-full border border-primary/10 bg-[color:var(--brand-white)] px-4 py-3 outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                >
                    <option value="">Selecione um assunto</option>
                    <option value="reservas">Reservas</option>
                    <option value="eventos">Eventos</option>
                    <option value="duvidas">Dúvidas Gerais</option>
                    <option value="outros">Outros</option>
                </select>
            </div>

            <div className="space-y-2">
                <label htmlFor="message" className="font-sans text-sm font-medium text-primary">Mensagem</label>
                <textarea
                    id="message"
                    required
                    rows={5}
                    className="w-full resize-none border border-primary/10 bg-[color:var(--brand-white)] px-4 py-3 outline-none transition-all focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                    placeholder="Como podemos ajudar?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
            </div>

            <Button type="submit" className="h-12 w-full rounded-none text-lg" disabled={loading}>
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Enviando...
                    </>
                ) : success ? (
                    "Mensagem Enviada com Sucesso!"
                ) : (
                    <>
                        Enviar Mensagem
                        <Send className="ml-2 h-5 w-5" />
                    </>
                )}
            </Button>
        </form>
    );
}
