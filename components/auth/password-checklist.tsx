import { getPasswordRuleResults } from "@/lib/auth/validation";

type PasswordChecklistProps = {
  password: string;
};

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const rules = getPasswordRuleResults(password);

  return (
    <ul className="space-y-1.5 text-sm" aria-live="polite">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={
            rule.met
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground/60"
          }
        >
          <span aria-hidden="true">{rule.met ? "✓" : "○"}</span>{" "}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
