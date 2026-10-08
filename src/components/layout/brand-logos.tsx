import { cn } from "@/lib/utils";

type BrandLogosProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogos({ className, compact = false }: BrandLogosProps) {
  return (
    <div
      className={cn("flex items-center", compact ? "gap-1.5" : "gap-3", className)}
      aria-label="Departamento de Ciências e Tecnologia e Prefeitura de Manacapuru"
    >
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-white/15 bg-black shadow-sm",
          compact ? "h-10 w-10" : "h-16 w-16 sm:h-20 sm:w-20",
        )}
      >
        <img
          src="/logo-01.jpeg"
          alt="Departamento de Ciências e Tecnologia"
          className="h-full w-full object-cover"
        />
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-white/15 bg-black shadow-sm",
          compact ? "h-10 w-[6.25rem]" : "h-16 w-40 sm:h-20 sm:w-52",
        )}
      >
        <img
          src="/logo-02.jpeg"
          alt="Prefeitura de Manacapuru"
          className="h-full w-full object-cover object-[center_18%]"
        />
      </div>
    </div>
  );
}
