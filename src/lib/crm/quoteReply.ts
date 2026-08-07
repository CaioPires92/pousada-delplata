function formatDateForGuest(dayKey: string) {
  const date = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dayKey;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function buildQuoteReplyText(input: {
  checkin: string;
  checkout: string;
  nights: number;
  options: Array<{ roomTypeName: string; totalPrice: number }>;
}) {
  const dailyLabel = input.nights === 1 ? "1 diária" : `${input.nights} diárias`;
  const lines = [
    `Para ${formatDateForGuest(input.checkin)} a ${formatDateForGuest(input.checkout)} (${dailyLabel}), temos:`,
  ];

  input.options.slice(0, 3).forEach(option => {
    lines.push(`• ${option.roomTypeName}: ${formatCurrency(option.totalPrice)}`);
  });

  return lines.join("\n");
}
