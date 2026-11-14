/**
 * Detecta, pelo User-Agent, se a requisição vem de um celular (smartphone).
 * Tablets e desktops ficam de fora de propósito — o "Mobile rate" do Booking
 * também mira quem reserva pelo celular. Sem User-Agent = não é mobile.
 */
const MOBILE_UA = /(iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini|Android[^;)]*;?[^)]*\bMobile\b|\bMobile\b.*\bSafari\b)/i;

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
    if (!userAgent) return false;
    if (/iPad|Tablet/i.test(userAgent)) return false;
    return MOBILE_UA.test(userAgent);
}

export function isMobileRequest(request: Pick<Request, 'headers'>): boolean {
    return isMobileUserAgent(request.headers.get('user-agent'));
}
