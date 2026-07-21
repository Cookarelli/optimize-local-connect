export const REQUEST_STATUSES = ["draft", "submitted", "reviewing", "assigned", "completed", "cancelled"] as const;
export const REQUEST_PRIORITIES = ["emergency", "today", "this_week", "flexible"] as const;
export function isOpenRequest(status: string) { return ["submitted", "reviewing"].includes(status); }
export function requestCounts(rows: Array<{ status: string }>) { return { submitted: rows.filter(row => row.status === "submitted").length, open: rows.filter(row => isOpenRequest(row.status)).length, assigned: rows.filter(row => row.status === "assigned").length, completed: rows.filter(row => row.status === "completed").length }; }
