import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

function filterNumericValue(value: string, allowDecimal: boolean): string {
  if (allowDecimal) {
    const oneDot = value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
    return oneDot
  }
  return value.replace(/\D/g, "")
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onChange, step, ...props }, ref) => {
    const allowDecimal =
      type === "number" &&
      (step === undefined || step === "any" || String(step).includes("."))
    const handleChange =
      type === "number" && onChange
        ? (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value
            const filtered = filterNumericValue(raw, !!allowDecimal)
            if (raw !== filtered) {
              e.target.value = filtered
            }
            onChange(e)
          }
        : onChange

    return (
      <input
        type={type}
        step={step}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
