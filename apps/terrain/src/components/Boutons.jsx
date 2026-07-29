export function BoutonDiscret({ children, ...props }) {
  return (
    <button
      {...props}
      className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function BoutonPrincipal({ children, ...props }) {
  return (
    <button
      {...props}
      className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  )
}
