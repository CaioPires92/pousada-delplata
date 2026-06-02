export type CrmLogLevel = "INFO" | "WARN" | "ERROR" | "AUTOMATION" | "SECURITY";

type CrmLogInput = {
  level: CrmLogLevel;
  action: string;
  message: string;
  context?: Record<string, unknown>;
};

export function crmLog(input: CrmLogInput) {
  const payload = {
    ts: new Date().toISOString(),
    level: input.level,
    action: input.action,
    message: input.message,
    context: input.context ?? {},
  };

  const line = JSON.stringify(payload);

  if (input.level === "ERROR") {
    console.error(line);
    return;
  }

  if (input.level === "WARN" || input.level === "SECURITY") {
    console.warn(line);
    return;
  }

  console.log(line);
}
