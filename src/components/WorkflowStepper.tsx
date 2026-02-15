import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  label: string;
  description: string;
};

const STEPS: Step[] = [
  { label: "Analyze", description: "Scan site for missing metadata" },
  { label: "Generate", description: "Create AI metadata suggestions" },
  { label: "Review", description: "Approve or reject suggestions" },
  { label: "Apply", description: "Push approved to WordPress" },
];

interface WorkflowStepperProps {
  currentStep: number; // 0-3
}

export default function WorkflowStepper({ currentStep }: WorkflowStepperProps) {
  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;

        return (
          <div key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-primary/10 text-primary",
                  !isComplete && !isCurrent && "border-border bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-xs font-medium",
                    isCurrent ? "text-primary" : isComplete ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-[10px] text-muted-foreground hidden sm:block">{step.description}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2 mt-[-1rem]",
                  i < currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
