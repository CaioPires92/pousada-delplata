const MONTHS_PT_BR = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export function formatDateBR(iso: string): string {
    const ymd = new Date(iso).toISOString().slice(0, 10);
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
}

export function formatDateBRFromYmd(ymd: string): string {
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
}

export function formatDatePtBrLong(iso: Date | string): string {
    const ymd = new Date(iso).toISOString().slice(0, 10);
    const [y, m, d] = ymd.split('-').map(Number);
    return `${String(d).padStart(2, '0')} de ${MONTHS_PT_BR[m - 1]} de ${y}`;
}
