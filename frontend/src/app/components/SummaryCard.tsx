'use client';

export function SummaryCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-700">{description}</p>
      </div>
      {children}
      {footer ? <div className="pt-2 border-t text-xs text-slate-600">{footer}</div> : null}
    </div>
  );
}
